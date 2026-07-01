# AEON-quoted launchpad with fee split & bid-wall floor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make $AEON the launchpad's quote token and split every trade 70/18/10/2 (creator / bid-wall / treasury / Rhegi platform), with a creator-seeded bid-wall floor bootstrapped by virtual reserves.

**Architecture:** `BondingCurveSale` is rewritten to quote in AEON instead of ETH: buys pull AEON and fan it out four ways (the 18% bid-wall residual stays in the contract); sells redeem AEON from the bid wall at `floor = wall / (V + sold)`. The creator seeds AEON at launch via the factory; a virtual circulating supply `V` makes the day-1 floor equal the curve's start price `P0 = seed / V`, which is provably arbitrage-free. The web trade/launch panels switch to AEON (approve→buy, seed-on-launch).

**Tech Stack:** Solidity 0.8.24 + Foundry + OpenZeppelin v5 (SafeERC20, ReentrancyGuard); Next.js + viem + wagmi + Vitest.

## Global Constraints

- Quote token = AEON `0xBf8E8f0e8866a7052F948C16508644347c57aba3`, Base mainnet (chainId **8453**), 18 decimals. Real AEON only exists on mainnet — local + Base Sepolia use a `MockAEON`.
- Buy split is fixed: **CREATOR_BPS=7000, TREASURY_BPS=1000, PLATFORM_BPS=200, BPS=10000**; bid wall keeps `cost - the three cuts` (1800 bps + rounding dust). No AEON may be lost to dust.
- Floor denominator is `V + sold` (virtual + real whole tokens); `V >= 1` so it never divides by zero.
- All AEON/token transfers use OpenZeppelin **SafeERC20**; `buy`/`sell` are **nonReentrant** with checks-effects-interactions ordering.
- Agent token has 18 decimals; whole-token amount `n` moves `n * 1e18` units. `sold`, `V`, `MAX_SUPPLY` are whole tokens; AEON amounts are wei.
- The 10% treasury cut is only **routed** to the treasury address here; buyback & burn is a separate follow-up.
- Run contract tests from `contracts/` with `forge test`; web tests from `web/` with `npm test`.

---

### Task 1: MockAEON (test/dev quote token)

**Files:**
- Create: `contracts/src/MockAEON.sol`
- Test: `contracts/test/MockAEON.t.sol`

**Interfaces:**
- Produces: `MockAEON` — standard ERC-20 named "Mock AEON"/"AEON", 18 decimals, with `mint(address to, uint256 amount)` (open faucet).

- [ ] **Step 1: Write the failing test**

```solidity
// contracts/test/MockAEON.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockAEON} from "../src/MockAEON.sol";

contract MockAEONTest is Test {
    MockAEON aeon;
    address alice = address(0xA11CE);

    function setUp() public {
        aeon = new MockAEON();
    }

    function test_metadata() public view {
        assertEq(aeon.symbol(), "AEON");
        assertEq(aeon.decimals(), 18);
    }

    function test_mint_faucet() public {
        aeon.mint(alice, 1_000e18);
        assertEq(aeon.balanceOf(alice), 1_000e18);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `forge test --match-contract MockAEONTest -vv`
Expected: FAIL — `MockAEON` source not found / does not compile.

- [ ] **Step 3: Write minimal implementation**

```solidity
// contracts/src/MockAEON.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Test/dev stand-in for AEON with an open faucet. NEVER deploy to mainnet.
contract MockAEON is ERC20 {
    constructor() ERC20("Mock AEON", "AEON") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `forge test --match-contract MockAEONTest -vv`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add contracts/src/MockAEON.sol contracts/test/MockAEON.t.sol
git commit -m "feat(contracts): MockAEON faucet token for local/testnet"
```

---

### Task 2: BondingCurveSale — AEON quote, fee split, bid-wall floor

**Files:**
- Modify (full rewrite): `contracts/src/BondingCurveSale.sol`
- Test (full rewrite): `contracts/test/BondingCurveSale.t.sol`

**Interfaces:**
- Consumes: `MockAEON` (Task 1), `AgentToken` (existing).
- Produces: `BondingCurveSale` with
  - constructor `(address aeon, address creator, address treasury, address rhegiPlatform, uint256 P0, uint256 SLOPE, uint256 MAX_SUPPLY, uint256 V)`
  - `initialize(address token, uint256 seed)` — sets token + `wall = seed`
  - views `areaUnder(uint256)`, `costToBuy(uint256)`, `quoteSell(uint256)`, `floorPrice()`
  - `buy(uint256 amount)` (non-payable, nonReentrant), `sell(uint256 amount)` (nonReentrant)
  - public state `token`, `sold`, `wall`, immutables `aeon`, `creator`, `treasury`, `rhegiPlatform`, `P0`, `SLOPE`, `MAX_SUPPLY`, `V`
  - constants `CREATOR_BPS=7000`, `TREASURY_BPS=1000`, `PLATFORM_BPS=200`, `BPS=10000`
  - errors `ExceedsSupply`, `NotInitialized`, `AlreadyInitialized`
  - events `Bought(buyer, amount, cost, creatorCut, wallCut, treasuryCut, platformCut)`, `Sold(seller, amount, payout)`

- [ ] **Step 1: Write the failing tests**

```solidity
// contracts/test/BondingCurveSale.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentToken} from "../src/AgentToken.sol";
import {BondingCurveSale} from "../src/BondingCurveSale.sol";
import {MockAEON} from "../src/MockAEON.sol";

contract BondingCurveSaleTest is Test {
    MockAEON aeon;
    AgentToken token;
    BondingCurveSale sale;

    uint256 constant P0 = 1e18;          // 1 AEON for the first token
    uint256 constant SLOPE = 1e16;
    uint256 constant MAX = 1_000_000;
    uint256 constant V = 1_000_000;      // virtual circulating
    uint256 constant SEED = 1_000_000e18; // 1,000,000 AEON => P0 == SEED/V == 1e18

    address creator = address(0xC0FFEE);
    address treasury = address(0x7);
    address platform = address(0x2);
    address alice = address(0xA11CE);

    function setUp() public {
        aeon = new MockAEON();
        sale = new BondingCurveSale(
            address(aeon), creator, treasury, platform, P0, SLOPE, MAX, V
        );
        token = new AgentToken("Agent", "AGT", address(sale), MAX * 1e18);
        // Factory normally transfers the seed in before initialize; emulate that here.
        aeon.mint(address(sale), SEED);
        sale.initialize(address(token), SEED);
    }

    function _buy(address who, uint256 n) internal {
        uint256 cost = sale.costToBuy(n);
        aeon.mint(who, cost);
        vm.startPrank(who);
        aeon.approve(address(sale), cost);
        sale.buy(n);
        vm.stopPrank();
    }

    function _sell(address who, uint256 n) internal {
        vm.startPrank(who);
        token.approve(address(sale), n * 1e18);
        sale.sell(n);
        vm.stopPrank();
    }

    function test_costToBuy_matchesCurve() public view {
        // first token costs P0; three tokens add SLOPE*(0+1+2)
        assertEq(sale.costToBuy(1), P0);
        assertEq(sale.costToBuy(3), P0 * 3 + SLOPE * 3);
    }

    function test_launchFloorEqualsP0() public view {
        assertEq(sale.sold(), 0);
        assertEq(sale.wall(), SEED);
        assertEq(sale.floorPrice(), P0); // SEED / (V + 0) == P0
    }

    function test_buy_splitsFees() public {
        uint256 cost = sale.costToBuy(1); // == P0 == 1e18
        aeon.mint(alice, cost);
        vm.startPrank(alice);
        aeon.approve(address(sale), cost);
        sale.buy(1);
        vm.stopPrank();

        assertEq(aeon.balanceOf(creator), cost * 7000 / 10000);
        assertEq(aeon.balanceOf(treasury), cost * 1000 / 10000);
        assertEq(aeon.balanceOf(platform), cost * 200 / 10000);
        uint256 wallCut = cost - cost * 7000 / 10000 - cost * 1000 / 10000 - cost * 200 / 10000;
        assertEq(sale.wall(), SEED + wallCut);
        assertEq(token.balanceOf(alice), 1e18);
        assertEq(sale.sold(), 1);
    }

    function test_buy_aeonAccountingIsExact() public {
        uint256 cost = sale.costToBuy(7);
        uint256 saleBefore = aeon.balanceOf(address(sale));
        _buy(alice, 7);
        uint256 retained = aeon.balanceOf(address(sale)) - saleBefore;
        assertEq(retained, sale.wall() - SEED); // residual == wall increment
        uint256 sent = aeon.balanceOf(creator) + aeon.balanceOf(treasury) + aeon.balanceOf(platform);
        assertEq(sent + retained, cost); // no AEON lost to dust
    }

    function test_sell_paysFromWallAtFloor() public {
        _buy(alice, 100);
        uint256 expected = sale.quoteSell(40);
        uint256 before = aeon.balanceOf(alice);
        _sell(alice, 40);
        assertEq(aeon.balanceOf(alice) - before, expected);
        assertEq(sale.sold(), 60);
    }

    function test_floor_neverDecreasesOnSell() public {
        _buy(alice, 200);
        uint256 f0 = sale.floorPrice();
        _sell(alice, 50);
        assertGe(sale.floorPrice(), f0);
        _sell(alice, 50);
        assertGe(sale.floorPrice(), f0);
    }

    function test_buy_revertsWhenExceedsMaxSupply() public {
        aeon.mint(alice, type(uint128).max);
        vm.startPrank(alice);
        aeon.approve(address(sale), type(uint128).max);
        vm.expectRevert(BondingCurveSale.ExceedsSupply.selector);
        sale.buy(MAX + 1);
        vm.stopPrank();
    }

    function test_sell_revertsWhenExceedsSold() public {
        _buy(alice, 5);
        vm.startPrank(alice);
        token.approve(address(sale), 6 * 1e18);
        vm.expectRevert(BondingCurveSale.ExceedsSupply.selector);
        sale.sell(6);
        vm.stopPrank();
    }

    function test_initialize_revertsWhenAlreadyInitialized() public {
        vm.expectRevert(BondingCurveSale.AlreadyInitialized.selector);
        sale.initialize(address(token), SEED);
    }

    function test_buy_revertsWhenNotInitialized() public {
        BondingCurveSale fresh = new BondingCurveSale(
            address(aeon), creator, treasury, platform, P0, SLOPE, MAX, V
        );
        aeon.mint(alice, 1e18);
        vm.startPrank(alice);
        aeon.approve(address(fresh), 1e18);
        vm.expectRevert(BondingCurveSale.NotInitialized.selector);
        fresh.buy(1);
        vm.stopPrank();
    }

    function testFuzz_roundTrip_neverProfits(uint32 nRaw) public {
        uint256 n = bound(uint256(nRaw), 1, 1000);
        uint256 cost = sale.costToBuy(n);
        aeon.mint(alice, cost);
        vm.startPrank(alice);
        aeon.approve(address(sale), cost);
        sale.buy(n);
        token.approve(address(sale), n * 1e18);
        uint256 before = aeon.balanceOf(alice);
        sale.sell(n);
        uint256 received = aeon.balanceOf(alice) - before;
        vm.stopPrank();
        assertLt(received, cost); // fees create a spread; round-trips always lose
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `forge test --match-contract BondingCurveSaleTest -vv`
Expected: FAIL — the rewritten `BondingCurveSale` API does not exist yet (compile errors: new constructor/signatures).

- [ ] **Step 3: Write the implementation**

```solidity
// contracts/src/BondingCurveSale.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Primary sale on a discrete linear bonding curve, quoted in AEON.
/// Buys split 70/18/10/2 (creator / bid wall / treasury / platform). Sells redeem
/// AEON from the bid wall at floor = wall / (V + sold). A virtual circulating
/// supply V makes the creator's launch seed an arbitrage-free day-1 floor:
/// floor0 = seed / V = P0, so buys always start at/above the floor.
contract BondingCurveSale is ReentrancyGuard {
    using SafeERC20 for IERC20;

    error ExceedsSupply();
    error NotInitialized();
    error AlreadyInitialized();

    uint256 public constant CREATOR_BPS = 7000;  // 70%
    uint256 public constant TREASURY_BPS = 1000; // 10%
    uint256 public constant PLATFORM_BPS = 200;  //  2%
    uint256 public constant BPS = 10_000;        // bid wall keeps the residual (~18% + dust)

    IERC20 public immutable aeon;
    address public immutable creator;
    address public immutable treasury;
    address public immutable rhegiPlatform;

    uint256 public immutable P0;         // AEON wei for the first whole token
    uint256 public immutable SLOPE;      // AEON wei added per whole token
    uint256 public immutable MAX_SUPPLY; // whole tokens
    uint256 public immutable V;          // virtual circulating supply (whole tokens)

    IERC20 public token; // the agent token being sold
    uint256 public sold; // real whole tokens released
    uint256 public wall; // AEON wei held as the bid wall

    event Bought(
        address indexed buyer,
        uint256 amount,
        uint256 cost,
        uint256 creatorCut,
        uint256 wallCut,
        uint256 treasuryCut,
        uint256 platformCut
    );
    event Sold(address indexed seller, uint256 amount, uint256 payout);

    constructor(
        address aeon_,
        address creator_,
        address treasury_,
        address rhegiPlatform_,
        uint256 p0,
        uint256 slope,
        uint256 maxSupply,
        uint256 v
    ) {
        aeon = IERC20(aeon_);
        creator = creator_;
        treasury = treasury_;
        rhegiPlatform = rhegiPlatform_;
        P0 = p0;
        SLOPE = slope;
        MAX_SUPPLY = maxSupply;
        V = v;
    }

    /// @notice Bind the agent token and seed the bid wall. The factory must have
    /// already transferred `seed` AEON into this contract.
    function initialize(address token_, uint256 seed) external {
        if (address(token) != address(0)) revert AlreadyInitialized();
        token = IERC20(token_);
        wall = seed;
    }

    /// @dev Cumulative AEON for the first `s` whole tokens. Guards s==0 underflow.
    function areaUnder(uint256 s) public view returns (uint256) {
        if (s == 0) return 0;
        return P0 * s + SLOPE * (s * (s - 1) / 2);
    }

    function costToBuy(uint256 amount) public view returns (uint256) {
        return areaUnder(sold + amount) - areaUnder(sold);
    }

    /// @notice AEON paid out for selling `amount` whole tokens at the floor.
    function quoteSell(uint256 amount) public view returns (uint256) {
        return wall * amount / (V + sold);
    }

    /// @notice Floor price in AEON wei per whole token.
    function floorPrice() external view returns (uint256) {
        return wall / (V + sold);
    }

    function buy(uint256 amount) external nonReentrant {
        if (address(token) == address(0)) revert NotInitialized();
        if (sold + amount > MAX_SUPPLY) revert ExceedsSupply();
        uint256 cost = costToBuy(amount);

        uint256 creatorCut = cost * CREATOR_BPS / BPS;
        uint256 treasuryCut = cost * TREASURY_BPS / BPS;
        uint256 platformCut = cost * PLATFORM_BPS / BPS;
        uint256 wallCut = cost - creatorCut - treasuryCut - platformCut; // ~18% + dust

        // Effects
        sold += amount;
        wall += wallCut;

        // Interactions: pull AEON, fan out cuts, release tokens.
        aeon.safeTransferFrom(msg.sender, address(this), cost);
        aeon.safeTransfer(creator, creatorCut);
        aeon.safeTransfer(treasury, treasuryCut);
        aeon.safeTransfer(rhegiPlatform, platformCut);
        token.safeTransfer(msg.sender, amount * 1e18);

        emit Bought(msg.sender, amount, cost, creatorCut, wallCut, treasuryCut, platformCut);
    }

    function sell(uint256 amount) external nonReentrant {
        if (amount > sold) revert ExceedsSupply();
        uint256 payout = quoteSell(amount);

        // Effects
        sold -= amount;
        wall -= payout;

        // Interactions: pull tokens back, pay AEON from the wall.
        token.safeTransferFrom(msg.sender, address(this), amount * 1e18);
        aeon.safeTransfer(msg.sender, payout);

        emit Sold(msg.sender, amount, payout);
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `forge test --match-contract BondingCurveSaleTest -vv`
Expected: PASS (all tests, including `testFuzz_roundTrip_neverProfits`).

- [ ] **Step 5: Commit**

```bash
git add contracts/src/BondingCurveSale.sol contracts/test/BondingCurveSale.t.sol
git commit -m "feat(contracts): AEON-quoted sale with 70/18/10/2 split + bid-wall floor"
```

---

### Task 3: AgentTokenFactory — creator seed + recipients

**Files:**
- Modify (rewrite): `contracts/src/AgentTokenFactory.sol`
- Test (rewrite): `contracts/test/AgentTokenFactory.t.sol`

**Interfaces:**
- Consumes: `BondingCurveSale` (Task 2), `MockAEON` (Task 1), `AgentRegistry`, `AvatarNFT`, `AgentToken` (existing).
- Produces: `AgentTokenFactory` with
  - constructor `(address registry, address avatars, address aeon, address treasury, address rhegiPlatform)`
  - constants `SLOPE`, `MAX_SUPPLY=1_000_000`, `V=1_000_000`, `MIN_SEED=100_000e18`
  - `createAgent(string name, string symbol, string avatarURI, bytes32 configHash, uint256 seed) returns (uint256 agentId, address token, address sale)` — requires `seed >= MIN_SEED`, sets `P0 = seed / V`, pulls `seed` AEON from `msg.sender` into the sale, initializes it, registers.
  - error `SeedTooLow`; event `AgentCreated(agentId, creator, token, sale, seed)`

- [ ] **Step 1: Write the failing tests**

```solidity
// contracts/test/AgentTokenFactory.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {AvatarNFT} from "../src/AvatarNFT.sol";
import {AgentTokenFactory} from "../src/AgentTokenFactory.sol";
import {BondingCurveSale} from "../src/BondingCurveSale.sol";
import {AgentToken} from "../src/AgentToken.sol";
import {MockAEON} from "../src/MockAEON.sol";

contract AgentTokenFactoryTest is Test {
    AgentRegistry registry;
    AvatarNFT avatars;
    AgentTokenFactory factory;
    MockAEON aeon;

    address treasury = address(0x7);
    address platform = address(0x2);
    address creator = address(0xC0FFEE);

    function setUp() public {
        registry = new AgentRegistry(address(this));
        avatars = new AvatarNFT(address(this));
        aeon = new MockAEON();
        factory = new AgentTokenFactory(
            address(registry), address(avatars), address(aeon), treasury, platform
        );
        registry.grantRole(registry.REGISTRAR_ROLE(), address(factory));
        avatars.setMinter(address(factory), true);
    }

    function _create(uint256 seed) internal returns (uint256 id, address token, address sale) {
        aeon.mint(creator, seed);
        vm.startPrank(creator);
        aeon.approve(address(factory), seed);
        (id, token, sale) = factory.createAgent("Agent", "AGT", "ipfs://x", bytes32(uint256(1)), seed);
        vm.stopPrank();
    }

    function test_createAgent_seedsWallAndSetsP0() public {
        uint256 seed = factory.MIN_SEED();
        (uint256 id, address token, address sale) = _create(seed);

        BondingCurveSale s = BondingCurveSale(sale);
        assertEq(s.wall(), seed);
        assertEq(s.creator(), creator);
        assertEq(s.treasury(), treasury);
        assertEq(s.rhegiPlatform(), platform);
        assertEq(s.P0(), seed / factory.V());
        assertEq(s.floorPrice(), seed / factory.V()); // floor0 == P0
        assertEq(AgentToken(token).balanceOf(sale), factory.MAX_SUPPLY() * 1e18);

        (, address regToken, address regSale,,) = registry.agents(id);
        assertEq(regToken, token);
        assertEq(regSale, sale);
        assertEq(aeon.balanceOf(sale), seed); // creator's AEON moved into the wall
    }

    function test_createAgent_revertsWhenSeedTooLow() public {
        uint256 seed = factory.MIN_SEED() - 1;
        aeon.mint(creator, seed);
        vm.startPrank(creator);
        aeon.approve(address(factory), seed);
        vm.expectRevert(AgentTokenFactory.SeedTooLow.selector);
        factory.createAgent("Agent", "AGT", "ipfs://x", bytes32(uint256(1)), seed);
        vm.stopPrank();
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `forge test --match-contract AgentTokenFactoryTest -vv`
Expected: FAIL — `createAgent` does not take a `seed`, constructor lacks AEON/recipients.

- [ ] **Step 3: Write the implementation**

```solidity
// contracts/src/AgentTokenFactory.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AgentRegistry} from "./AgentRegistry.sol";
import {AvatarNFT} from "./AvatarNFT.sol";
import {AgentToken} from "./AgentToken.sol";
import {BondingCurveSale} from "./BondingCurveSale.sol";

/// @notice Launches an agent in one tx: mint avatar, deploy token+sale, seed the
/// bid-wall floor with the creator's AEON, register.
contract AgentTokenFactory {
    using SafeERC20 for IERC20;

    // Curve slope is an economic tuning knob (see spec open params); P0 is derived
    // per-launch from the seed so the day-1 floor equals the start price.
    uint256 public constant SLOPE = 1e12;
    uint256 public constant MAX_SUPPLY = 1_000_000; // whole tokens
    uint256 public constant V = MAX_SUPPLY;         // virtual circulating supply
    uint256 public constant MIN_SEED = 100_000e18;  // 100,000 AEON

    AgentRegistry public immutable registry;
    AvatarNFT public immutable avatars;
    IERC20 public immutable aeon;
    address public immutable treasury;
    address public immutable rhegiPlatform;

    error SeedTooLow();

    event AgentCreated(
        uint256 indexed agentId, address indexed creator, address token, address sale, uint256 seed
    );

    constructor(
        address registry_,
        address avatars_,
        address aeon_,
        address treasury_,
        address rhegiPlatform_
    ) {
        registry = AgentRegistry(registry_);
        avatars = AvatarNFT(avatars_);
        aeon = IERC20(aeon_);
        treasury = treasury_;
        rhegiPlatform = rhegiPlatform_;
    }

    function createAgent(
        string calldata name,
        string calldata symbol,
        string calldata avatarURI,
        bytes32 configHash,
        uint256 seed
    ) external returns (uint256 agentId, address token, address sale) {
        if (seed < MIN_SEED) revert SeedTooLow();
        uint256 p0 = seed / V;

        agentId = avatars.mint(msg.sender, avatarURI);

        BondingCurveSale s =
            new BondingCurveSale(address(aeon), msg.sender, treasury, rhegiPlatform, p0, SLOPE, MAX_SUPPLY, V);
        AgentToken t = new AgentToken(name, symbol, address(s), MAX_SUPPLY * 1e18);

        // Pull the creator's seed AEON into the sale, then bind token + seed the wall.
        aeon.safeTransferFrom(msg.sender, address(s), seed);
        s.initialize(address(t), seed);

        registry.register(agentId, msg.sender, address(t), address(s), agentId, configHash);

        emit AgentCreated(agentId, msg.sender, address(t), address(s), seed);
        return (agentId, address(t), address(s));
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `forge test --match-contract AgentTokenFactoryTest -vv`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full contract suite + commit**

Run: `forge test`
Expected: PASS (all contracts).

```bash
git add contracts/src/AgentTokenFactory.sol contracts/test/AgentTokenFactory.t.sol
git commit -m "feat(contracts): factory pulls creator AEON seed into the bid-wall floor"
```

---

### Task 4: Deploy script + AEON wiring + ABI/manifest export

**Files:**
- Modify: `contracts/script/Deploy.s.sol`
- Modify: `contracts/script/deploy-sepolia.sh`
- Modify: `contracts/script/export-abis.sh`
- Modify: `web/src/lib/contracts/abis/addresses.local.json`

**Interfaces:**
- Consumes: `AgentTokenFactory` (Task 3), `MockAEON` (Task 1).
- Produces: a deploy flow that resolves AEON from `AEON_ADDRESS` (or deploys `MockAEON` when unset), reads `TREASURY_ADDRESS`/`RHEGI_PLATFORM_ADDRESS` (default deployer), logs `AEON:`, and writes an `AEON` field into the address manifest.

- [ ] **Step 1: Rewrite the deploy script**

```solidity
// contracts/script/Deploy.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {AvatarNFT} from "../src/AvatarNFT.sol";
import {AgentTokenFactory} from "../src/AgentTokenFactory.sol";
import {MockAEON} from "../src/MockAEON.sol";

contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address executor = vm.envAddress("EXECUTOR_ADDRESS");
        address deployer = vm.addr(pk);

        // Real AEON only exists on mainnet; deploy a mock when AEON_ADDRESS is unset.
        address aeon = vm.envOr("AEON_ADDRESS", address(0));
        address treasury = vm.envOr("TREASURY_ADDRESS", deployer);
        address platform = vm.envOr("RHEGI_PLATFORM_ADDRESS", deployer);

        vm.startBroadcast(pk);
        if (aeon == address(0)) {
            aeon = address(new MockAEON());
        }
        AgentRegistry registry = new AgentRegistry(deployer);
        AvatarNFT avatars = new AvatarNFT(deployer);
        AgentTokenFactory factory =
            new AgentTokenFactory(address(registry), address(avatars), aeon, treasury, platform);

        registry.grantRole(registry.REGISTRAR_ROLE(), address(factory));
        registry.grantRole(registry.EXECUTOR_ROLE(), executor);
        avatars.setMinter(address(factory), true);
        vm.stopBroadcast();

        console.log("AEON:", aeon);
        console.log("AgentRegistry:", address(registry));
        console.log("AvatarNFT:", address(avatars));
        console.log("AgentTokenFactory:", address(factory));
    }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd contracts && forge build`
Expected: compiles cleanly.

- [ ] **Step 3: Add MockAEON to the ABI export list**

In `contracts/script/export-abis.sh`, change the loop list to include `MockAEON`:

```bash
for c in AgentRegistry AgentTokenFactory AgentToken BondingCurveSale AvatarNFT MockAEON; do
```

- [ ] **Step 4: Capture & write the AEON address in the Sepolia manifest**

In `contracts/script/deploy-sepolia.sh`, after the existing `FAC=...` line add:

```bash
AEO=$(echo "$OUT" | grep "AEON:" | awk '{print $NF}')
```

Add `AEO` to the emptiness guard:

```bash
if [ -z "$REG" ] || [ -z "$NFT" ] || [ -z "$FAC" ] || [ -z "$AEO" ]; then
```

And replace the `MANIFEST=$(cat <<JSON ... JSON)` block with one that includes AEON:

```bash
MANIFEST=$(cat <<JSON
{
  "chainId": 84532,
  "AEON": "$AEO",
  "AgentRegistry": "$REG",
  "AvatarNFT": "$NFT",
  "AgentTokenFactory": "$FAC"
}
JSON
)
```

- [ ] **Step 5: Add the AEON field to the local manifest**

Rewrite `web/src/lib/contracts/abis/addresses.local.json` (the MockAEON is the first contract deployed by `Deploy.s.sol` on Anvil, so it takes the first deterministic address):

```json
{
  "chainId": 31337,
  "AEON": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  "AgentRegistry": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  "AvatarNFT": "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  "AgentTokenFactory": "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"
}
```

> Note: addresses shift by one slot now that `MockAEON` deploys first. Re-run `script/deploy-local.sh` and paste the printed addresses if your Anvil ordering differs.

- [ ] **Step 6: Commit**

```bash
git add contracts/script/Deploy.s.sol contracts/script/deploy-sepolia.sh contracts/script/export-abis.sh web/src/lib/contracts/abis/addresses.local.json
git commit -m "feat(contracts): deploy AEON (mock off-mainnet) + write AEON into manifest"
```

---

### Task 5: Web contracts layer — Base mainnet + AEON manifest field

**Files:**
- Modify: `web/src/lib/contracts/index.ts`
- Create: `web/src/lib/contracts/abis/addresses.base-mainnet.json`
- Modify: `web/src/lib/contracts/abis/addresses.base-sepolia.json`
- Test: `web/src/lib/contracts/index.test.ts`

**Interfaces:**
- Produces: `Deployment` type now has `AEON: string`; `DEPLOYMENTS` includes `base` (8453); `activeChain()` resolves mainnet; `deployment().AEON` returns the quote-token address.

- [ ] **Step 1: Write the failing test**

```ts
// web/src/lib/contracts/index.test.ts
import { test, expect } from "vitest";
import { deployment } from "./index";

test("base mainnet deployment exposes the real AEON address", () => {
  const d = deployment(8453);
  expect(d.AEON.toLowerCase()).toBe("0xbf8e8f0e8866a7052f948c16508644347c57aba3");
  expect(d.chainId).toBe(8453);
});

test("base sepolia deployment exposes an AEON address", () => {
  const d = deployment(84532);
  expect(d.AEON).toMatch(/^0x[0-9a-fA-F]{40}$/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/lib/contracts/index.test.ts`
Expected: FAIL — `deployment(8453)` throws (no mainnet entry) / `AEON` missing.

- [ ] **Step 3: Create the mainnet manifest**

```json
// web/src/lib/contracts/abis/addresses.base-mainnet.json
{
  "chainId": 8453,
  "AEON": "0xBf8E8f0e8866a7052F948C16508644347c57aba3",
  "AgentRegistry": "0x0000000000000000000000000000000000000000",
  "AvatarNFT": "0x0000000000000000000000000000000000000000",
  "AgentTokenFactory": "0x0000000000000000000000000000000000000000"
}
```

> The three zero addresses are filled in by `deploy` when the app goes to mainnet; AEON is already live.

- [ ] **Step 4: Add the AEON field to the existing Sepolia manifest**

Edit `web/src/lib/contracts/abis/addresses.base-sepolia.json` to add an `AEON` key (placeholder until the next Sepolia deploy writes the mock address):

```json
{
  "chainId": 84532,
  "AEON": "0x0000000000000000000000000000000000000000",
  "AgentRegistry": "0x4a25D6aCfD3C44334bE327dcAA91aC9D3c368d09",
  "AvatarNFT": "0x832b5ab3A1148AAfF55cF27F96725301620AAc63",
  "AgentTokenFactory": "0x4db7e4d1e6E4a8c3EF9a1741dBa4Af8701d70fa2"
}
```

- [ ] **Step 5: Update `index.ts`**

Add `base` to the chain imports and register it. Apply these edits:

```ts
// line 2 — add base
import { foundry, baseSepolia, base } from "viem/chains";
```

```ts
// after the existing addressesSepolia import
import addressesMainnet from "./abis/addresses.base-mainnet.json";
```

```ts
// extend the Deployment type
export type Deployment = {
  chainId: number;
  AEON: string;
  AgentRegistry: string;
  AvatarNFT: string;
  AgentTokenFactory: string;
};
```

```ts
// register mainnet in DEPLOYMENTS
const DEPLOYMENTS: Record<number, Deployment> = {
  [foundry.id]: addressesLocal as Deployment,
  [baseSepolia.id]: addressesSepolia as Deployment,
  [base.id]: addressesMainnet as Deployment,
};
```

```ts
// activeChain() — resolve mainnet too
export function activeChain() {
  const id = activeChainId();
  if (id === base.id) return base;
  if (id === baseSepolia.id) return baseSepolia;
  return foundry;
}
```

```ts
// publicClient() — resolve mainnet too
export function publicClient(chainId: number = activeChainId()) {
  const chain = chainId === base.id ? base : chainId === baseSepolia.id ? baseSepolia : foundry;
  return createPublicClient({ chain, transport: http(rpcUrl()) });
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd web && npx vitest run src/lib/contracts/index.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/contracts/index.ts web/src/lib/contracts/index.test.ts web/src/lib/contracts/abis/addresses.base-mainnet.json web/src/lib/contracts/abis/addresses.base-sepolia.json
git commit -m "feat(web): register Base mainnet + AEON quote-token address in manifests"
```

---

### Task 6: TradePanel — AEON approve→buy, floor sell, fee breakdown

**Files:**
- Modify (rewrite): `web/src/ui/TradePanel.tsx`
- Modify: `web/src/ui/TradePanel.test.tsx`

**Interfaces:**
- Consumes: `deployment().AEON` (Task 5), `BondingCurveSale` ABI with `costToBuy`/`quoteSell`/`floorPrice`/`wall`/`sold`/`buy`/`sell` (Task 2), viem `erc20Abi` for AEON `approve`/`allowance`/`balanceOf`.
- Produces: a trade panel that buys with AEON (approve `cost` → `buy(amount)`), shows the AEON cost, the 70/18/10/2 breakdown, the floor sell quote, bid-wall depth, and the user's AEON balance/allowance.

- [ ] **Step 1: Update the test (failing)**

```tsx
// web/src/ui/TradePanel.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { TradePanel } from "./TradePanel";

const WAD = 1_000_000_000_000_000_000n;

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0x0000000000000000000000000000000000000001", isConnected: true }),
  useReadContract: (cfg: { functionName?: string; args?: unknown[] }) => {
    if (cfg?.functionName === "costToBuy") {
      const amount = BigInt((cfg.args?.[0] as bigint) ?? 0n);
      return { data: amount * WAD }; // cost == amount AEON
    }
    if (cfg?.functionName === "quoteSell") {
      const amount = BigInt((cfg.args?.[0] as bigint) ?? 0n);
      return { data: amount * WAD }; // floor payout == amount AEON
    }
    if (cfg?.functionName === "sold") return { data: 5n };
    if (cfg?.functionName === "wall") return { data: 100n * WAD };
    if (cfg?.functionName === "balanceOf") return { data: 3n * WAD };
    if (cfg?.functionName === "allowance") return { data: 0n };
    return { data: undefined };
  },
  useWriteContract: () => ({ writeContractAsync: vi.fn() }),
  useWaitForTransactionReceipt: () => ({ isLoading: false, isSuccess: false }),
}));

vi.mock("@/lib/contracts", () => ({
  abis: { AgentToken: [], BondingCurveSale: [] },
  deployment: () => ({ AEON: "0x00000000000000000000000000000000000000Ae" }),
  activeChain: () => ({ id: 31337 }),
}));

const props = { saleAddress: "0xSale", tokenAddress: "0xToken" };

test("renders buy/sell/delegate controls when connected", () => {
  render(<TradePanel {...props} />);
  expect(screen.getByRole("button", { name: /buy/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /sell/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /delegate/i })).toBeInTheDocument();
});

test("shows the AEON cost and the fee breakdown", () => {
  render(<TradePanel {...props} />);
  fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "10" } });
  // cost == 10 AEON; creator 70% == 7
  expect(screen.getByTestId("cost").textContent).toContain("10");
  expect(screen.getByTestId("fee-creator").textContent).toContain("7");
  expect(screen.getByTestId("fee-wall").textContent).toContain("1.8");
  expect(screen.getByTestId("sell-quote").textContent).toContain("10");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/ui/TradePanel.test.tsx`
Expected: FAIL — `fee-creator`/`sell-quote` testids and `deployment` mock usage don't exist yet.

- [ ] **Step 3: Rewrite `TradePanel.tsx`**

```tsx
// web/src/ui/TradePanel.tsx
"use client";

import { useCallback, useMemo, useState } from "react";
import { erc20Abi, formatEther } from "viem";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { abis, deployment } from "@/lib/contracts";
import { Panel } from "@/ui/Panel";
import { Button } from "@/ui/Button";
import { MonoNum } from "@/ui/MonoNum";

const WAD = 1_000_000_000_000_000_000n;
// Mirrors BondingCurveSale BPS constants.
const SPLIT = { creator: 7000n, wall: 1800n, treasury: 1000n, platform: 200n };
const BPS = 10_000n;

function fmt(v: bigint | undefined): string {
  return v != null ? formatEther(v) : "—";
}

export function TradePanel({
  saleAddress,
  tokenAddress,
}: {
  saleAddress: string;
  tokenAddress: string;
}) {
  const { address, isConnected } = useAccount();
  const sale = saleAddress as `0x${string}`;
  const token = tokenAddress as `0x${string}`;
  const aeon = deployment().AEON as `0x${string}`;

  const [amount, setAmount] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const amountUnits = useMemo(() => {
    const n = Number(amount);
    return Number.isFinite(n) && n > 0 ? BigInt(Math.floor(n)) : 0n;
  }, [amount]);
  const amountWei = amountUnits * WAD;

  const { data: sold } = useReadContract({ address: sale, abi: abis.BondingCurveSale, functionName: "sold" });
  const { data: wall } = useReadContract({ address: sale, abi: abis.BondingCurveSale, functionName: "wall" });
  const { data: cost } = useReadContract({
    address: sale, abi: abis.BondingCurveSale, functionName: "costToBuy", args: [amountUnits],
  });
  const { data: sellQuote } = useReadContract({
    address: sale, abi: abis.BondingCurveSale, functionName: "quoteSell", args: [amountUnits],
  });
  const { data: tokenBal } = useReadContract({
    address: token, abi: abis.AgentToken, functionName: "balanceOf",
    args: address ? [address] : undefined, query: { enabled: !!address },
  });
  const { data: aeonBal } = useReadContract({
    address: aeon, abi: erc20Abi, functionName: "balanceOf",
    args: address ? [address] : undefined, query: { enabled: !!address },
  });
  const { data: aeonAllowance } = useReadContract({
    address: aeon, abi: erc20Abi, functionName: "allowance",
    args: address ? [address, sale] : undefined, query: { enabled: !!address },
  });

  const costWei = (cost as bigint) ?? 0n;
  const fees = {
    creator: (costWei * SPLIT.creator) / BPS,
    wall: (costWei * SPLIT.wall) / BPS,
    treasury: (costWei * SPLIT.treasury) / BPS,
    platform: (costWei * SPLIT.platform) / BPS,
  };

  const { writeContractAsync, data: txHash } = useWriteContract();
  useWaitForTransactionReceipt({ hash: txHash });

  const buy = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      // Approve AEON for the sale if the current allowance is short, then buy.
      if (((aeonAllowance as bigint) ?? 0n) < costWei) {
        await writeContractAsync({
          address: aeon, abi: erc20Abi, functionName: "approve", args: [sale, costWei],
        });
      }
      await writeContractAsync({
        address: sale, abi: abis.BondingCurveSale, functionName: "buy", args: [amountUnits],
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [writeContractAsync, aeon, sale, amountUnits, costWei, aeonAllowance]);

  const sell = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await writeContractAsync({
        address: token, abi: abis.AgentToken, functionName: "approve", args: [sale, amountWei],
      });
      await writeContractAsync({
        address: sale, abi: abis.BondingCurveSale, functionName: "sell", args: [amountUnits],
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [writeContractAsync, token, sale, amountUnits, amountWei]);

  const delegate = useCallback(async () => {
    if (!address) return;
    setBusy(true);
    setError(null);
    try {
      await writeContractAsync({
        address: token, abi: abis.AgentToken, functionName: "delegate", args: [address],
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [writeContractAsync, token, address]);

  if (!isConnected) {
    return (
      <Panel className="space-y-2">
        <div className="text-xs uppercase font-mono text-muted">Trade</div>
        <p className="text-xs text-muted">Connect a wallet to trade this token in AEON.</p>
      </Panel>
    );
  }

  return (
    <Panel className="space-y-4">
      <div className="text-xs uppercase font-mono text-muted">Trade · AEON</div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-muted uppercase font-mono">Sold</div>
          <MonoNum>{sold != null ? formatEther((sold as bigint) * WAD) : "—"}</MonoNum>
        </div>
        <div>
          <div className="text-muted uppercase font-mono">Bid wall (AEON)</div>
          <MonoNum>{fmt(wall as bigint)}</MonoNum>
        </div>
        <div>
          <div className="text-muted uppercase font-mono">Your tokens</div>
          <MonoNum>{fmt(tokenBal as bigint)}</MonoNum>
        </div>
        <div>
          <div className="text-muted uppercase font-mono">Your AEON</div>
          <MonoNum>{fmt(aeonBal as bigint)}</MonoNum>
        </div>
      </div>

      <label className="block text-xs">
        <span className="text-muted uppercase font-mono">Amount (tokens)</span>
        <input
          aria-label="amount"
          type="number"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 w-full bg-void border border-muted/30 rounded-lg px-3 py-2 font-mono"
        />
      </label>

      <div className="text-xs">
        <span className="text-muted uppercase font-mono">Cost </span>
        <MonoNum>
          <span data-testid="cost">{fmt(cost as bigint)}</span> AEON
        </MonoNum>
      </div>

      <div className="border border-muted/15 rounded-lg p-2 space-y-1 text-xs">
        <div className="text-muted uppercase font-mono">Fee split on buy</div>
        <div className="flex justify-between"><span>Creator 70%</span><MonoNum><span data-testid="fee-creator">{fmt(fees.creator)}</span></MonoNum></div>
        <div className="flex justify-between"><span>Bid wall 18%</span><MonoNum><span data-testid="fee-wall">{fmt(fees.wall)}</span></MonoNum></div>
        <div className="flex justify-between"><span>Treasury 10%</span><MonoNum><span data-testid="fee-treasury">{fmt(fees.treasury)}</span></MonoNum></div>
        <div className="flex justify-between"><span>Rhegi 2%</span><MonoNum><span data-testid="fee-platform">{fmt(fees.platform)}</span></MonoNum></div>
      </div>

      <div className="text-xs">
        <span className="text-muted uppercase font-mono">Sell at floor </span>
        <MonoNum>
          <span data-testid="sell-quote">{fmt(sellQuote as bigint)}</span> AEON
        </MonoNum>
      </div>

      <div className="flex gap-3">
        <Button className="flex-1" disabled={busy || amountUnits === 0n} onClick={buy}>Buy</Button>
        <Button variant="ghost" className="flex-1" disabled={busy || amountUnits === 0n} onClick={sell}>Sell</Button>
      </div>

      <div className="border-t border-muted/15 pt-3 space-y-2">
        <Button variant="volt" className="w-full" disabled={busy} onClick={delegate}>Delegate to self</Button>
        <p className="text-xs text-muted">
          ERC20Votes voting power stays at zero until you delegate — delegate to yourself to activate it.
        </p>
      </div>

      {error && <p className="text-xs text-red-400 break-all">{error}</p>}
    </Panel>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/ui/TradePanel.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/ui/TradePanel.tsx web/src/ui/TradePanel.test.tsx
git commit -m "feat(web): trade in AEON — approve→buy, floor sell quote, fee breakdown"
```

---

### Task 7: LaunchPanel — AEON seed input + approve before createAgent

**Files:**
- Modify: `web/src/ui/LaunchPanel.tsx`
- Test: `web/src/ui/LaunchPanel.test.tsx`

**Interfaces:**
- Consumes: `deployment().AEON` + `AgentTokenFactory` (with `createAgent(name, symbol, uri, configHash, seed)` and `MIN_SEED`) from Tasks 3 & 5, viem `erc20Abi` for the AEON approve.
- Produces: a launch panel that collects a seed AEON amount (≥ on-chain `MIN_SEED`), approves AEON to the factory, and passes `seed` into `simulateContract`/`createAgent`.

- [ ] **Step 1: Write the failing test**

```tsx
// web/src/ui/LaunchPanel.test.tsx
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { LaunchPanel, deriveSymbol } from "./LaunchPanel";

vi.mock("wagmi", () => ({
  useAccount: () => ({ isConnected: true }),
  usePublicClient: () => ({ simulateContract: vi.fn() }),
  useReadContract: (cfg: { functionName?: string }) => {
    if (cfg?.functionName === "MIN_SEED") return { data: 100_000n * 10n ** 18n };
    return { data: undefined };
  },
  useWriteContract: () => ({ writeContractAsync: vi.fn() }),
  useWaitForTransactionReceipt: () => ({ isLoading: false, isSuccess: false }),
}));

vi.mock("@/lib/contracts", () => ({
  abis: { AgentTokenFactory: [] },
  deployment: () => ({ AgentTokenFactory: "0xFac", AEON: "0xAe" }),
}));

test("deriveSymbol still takes the first 4 alphanumerics uppercased", () => {
  expect(deriveSymbol("My cool agent")).toBe("MYCO");
});

test("shows a seed amount field for draft agents", () => {
  render(<LaunchPanel agentId="1" name="Agent" configHash="0x00" status="draft" />);
  expect(screen.getByLabelText(/seed/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/ui/LaunchPanel.test.tsx`
Expected: FAIL — no `seed` field rendered.

- [ ] **Step 3: Edit `LaunchPanel.tsx`**

Add imports (extend the existing wagmi import and add erc20Abi + parseEther):

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { erc20Abi, parseEther } from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { abis, deployment } from "@/lib/contracts";
```

Inside the component, after the existing state declarations add a seed input + the on-chain minimum:

```tsx
  const [seed, setSeed] = useState("100000");
  const factoryAddr = deployment().AgentTokenFactory as `0x${string}`;
  const aeon = deployment().AEON as `0x${string}`;
  const { data: minSeed } = useReadContract({
    address: factoryAddr, abi: abis.AgentTokenFactory, functionName: "MIN_SEED",
  });
  const seedWei = useMemo(() => {
    try { return parseEther(seed || "0"); } catch { return 0n; }
  }, [seed]);
  const seedTooLow = minSeed != null && seedWei < (minSeed as bigint);
```

Replace the body of `launch` so it approves AEON and passes the seed:

```tsx
  const launch = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const factory = factoryAddr;
      const args = [name, deriveSymbol(name), "ipfs://" + agentId, configHash as `0x${string}`, seedWei] as const;

      const sim = await publicClient!.simulateContract({
        address: factory,
        abi: abis.AgentTokenFactory,
        functionName: "createAgent",
        args,
      });
      const [onChainAgentId, token, sale] = sim.result as [bigint, string, string];
      setPending({ token, sale, onChainAgentId });

      // The factory pulls the seed AEON from the creator — approve it first.
      await writeContractAsync({
        address: aeon, abi: erc20Abi, functionName: "approve", args: [factory, seedWei],
      });
      await writeContractAsync({
        address: factory,
        abi: abis.AgentTokenFactory,
        functionName: "createAgent",
        args,
      });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }, [agentId, name, configHash, publicClient, writeContractAsync, factoryAddr, aeon, seedWei]);
```

Add the seed field + min hint inside the draft `isConnected` branch, before the Launch button:

```tsx
          <label className="block text-xs">
            <span className="text-muted uppercase font-mono">Seed floor (AEON)</span>
            <input
              aria-label="seed amount (AEON)"
              type="number"
              min="0"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              className="mt-1 w-full bg-void border border-muted/30 rounded-lg px-3 py-2 font-mono"
            />
            <span className="text-muted">
              Your AEON seeds the bid-wall floor. Minimum 100,000 AEON.
            </span>
          </label>
```

Update the Launch button's disabled guard to include `seedTooLow`:

```tsx
          <Button className="w-full" disabled={busy || confirming || seedTooLow} onClick={launch}>
            {busy || confirming ? "Launching…" : "Launch token"}
          </Button>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/ui/LaunchPanel.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full web suite + commit**

Run: `cd web && npm test`
Expected: PASS (existing + new tests).

```bash
git add web/src/ui/LaunchPanel.tsx web/src/ui/LaunchPanel.test.tsx
git commit -m "feat(web): launch seeds the AEON bid-wall floor (approve + seed arg)"
```

---

### Task 8: Regenerate ABIs into the web app

**Files:**
- Modify (generated): `web/src/lib/contracts/abis/AgentTokenFactory.json`, `BondingCurveSale.json` (+ any others the build refreshes)

**Interfaces:**
- Consumes: all contract changes (Tasks 1–4). Produces: web ABIs matching the new on-chain signatures so `createAgent(...,seed)`, `quoteSell`, `floorPrice`, `wall`, and `MIN_SEED` are callable from the app.

- [ ] **Step 1: Build + export the ABIs**

Run: `cd contracts && ./script/export-abis.sh`
Expected: prints `exported out/aetherd-abis/<Contract>.json` for each contract incl. MockAEON.

- [ ] **Step 2: Sync ABIs into the web app**

Run: `cd web && npm run sync:abis`
Expected: copies the JSON ABIs into `src/lib/contracts/abis/`.

- [ ] **Step 3: Verify the new signatures landed**

Run: `cd web && node -e "const a=require('./src/lib/contracts/abis/AgentTokenFactory.json'); const c=a.find(x=>x.name==='createAgent'); console.log(c.inputs.map(i=>i.name).join(','))"`
Expected output: `name,symbol,avatarURI,configHash,seed`

- [ ] **Step 4: Run full web + contract suites**

Run: `cd contracts && forge test && cd ../web && npm test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/contracts/abis/*.json
git commit -m "chore(web): regenerate ABIs for AEON sale + seeded factory"
```

---

## Self-Review

**Spec coverage:**
- D1 AEON quote → Tasks 2 (sale), 5/6 (web). ✓
- D2 70/18/10/2 split → Task 2 (`buy`), Task 6 (breakdown). ✓
- D3 bid-wall floor / `wall / circulating` → Task 2 (`sell`/`quoteSell`/`floorPrice`). ✓
- D4 creator seeds at launch → Task 3 (factory pull), Task 7 (seed UI). ✓
- D5 virtual reserves (`floor0 = S/V = P0`) → Task 2 (`V` denominator), Task 3 (`P0 = seed/V`), tests in 2 & 3. ✓
- D6 route 10% to treasury, burn later → Task 2 (`treasuryCut` transfer only). ✓
- D7 mock AEON off-mainnet → Tasks 1, 4, 5. ✓
- SafeERC20 + nonReentrant + CEI → Task 2. ✓
- No-AEON-dust → Task 2 (`wallCut` residual) + `test_buy_aeonAccountingIsExact`. ✓
- Base mainnet (8453) registration → Task 5. ✓
- ABI regeneration so web matches chain → Task 8. ✓

**Placeholder scan:** No TBD/TODO. The mainnet manifest's three zero addresses and the Sepolia AEON zero placeholder are intentional (filled by deploy) and documented inline. `SLOPE = 1e12` is a real default with a comment that it's the economic tuning knob from the spec.

**Type consistency:** Constructor arg order `(aeon, creator, treasury, rhegiPlatform, P0, SLOPE, MAX_SUPPLY, V)` is identical in Task 2 impl, Task 2 tests, and Task 3 factory. `quoteSell`/`floorPrice`/`wall`/`sold` names match across Tasks 2, 6. `createAgent(...seed)` signature matches across Tasks 3, 7, 8. `MIN_SEED`/`V`/`MAX_SUPPLY` getters used in tests exist as public constants. `deployment().AEON` added in Task 5 before its consumers in Tasks 6–7.
```
