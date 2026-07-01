# AeTherD Contracts (Plan 1 of 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and Foundry-test the five Base-Sepolia contracts that back AeTherD's launchpad + on-chain config anchoring, and a deploy script that emits ABIs + addresses for the app.

**Architecture:** A factory (`AgentTokenFactory`) launches each agent in one tx: it mints an `AvatarNFT` (its tokenId becomes the `agentId`), deploys an `AgentToken` (ERC20Votes) with its full supply held by a `BondingCurveSale`, and registers everything in `AgentRegistry`. The registry stores the agent's content-addressed config hash; only an off-chain Executor (granted `EXECUTOR_ROLE`) may update it. Token price follows a discrete linear bonding curve with a closed-form integer integral, so buys/sells are exactly invertible and the ETH reserve is always solvent.

**Tech Stack:** Solidity ^0.8.24, Foundry (forge/anvil), OpenZeppelin Contracts v5 (`ERC20Votes`, `ERC721`, `AccessControl`), Base Sepolia.

---

## Conventions & shared constants

- Solidity `^0.8.24`, optimizer on (200 runs). Overflow checks are on by default (no `unchecked` in curve math).
- Token decimals = 18. The sale trades in **whole tokens**; on-chain it tracks `sold` (a whole-token count) and moves `n * 1e18` ERC20 units.
- Curve constants (immutable on the sale, set by factory):
  - `P0 = 1e12` wei (price of the first token)
  - `SLOPE = 1e6` wei (price increase per additional whole token)
  - `MAX_SUPPLY = 1_000_000` whole tokens → minted as `1_000_000 * 1e18` units
- **Area integral** (cumulative ETH cost to sell the first `s` whole tokens):
  `areaUnder(s) = P0 * s + SLOPE * (s * (s - 1) / 2)`
  - Cost to buy `n` tokens at current `sold`: `areaUnder(sold + n) - areaUnder(sold)`
  - Refund to sell `n` tokens at current `sold`: `areaUnder(sold) - areaUnder(sold - n)`
  - Reserve invariant: contract ETH balance always equals `areaUnder(sold)`.
- Roles: `AgentRegistry` is `AccessControl` with `REGISTRAR_ROLE` (held by the factory) and `EXECUTOR_ROLE` (held by the off-chain executor key). Deployer holds `DEFAULT_ADMIN_ROLE`.

## File structure

```
contracts/
  foundry.toml
  remappings.txt
  .env.example
  src/
    AvatarNFT.sol          # ERC721, agentId = tokenId, minter-gated
    AgentToken.sol         # ERC20Votes, full supply minted to a recipient
    BondingCurveSale.sol   # linear curve buy/sell, holds token supply + ETH reserve
    AgentRegistry.sol      # agentId -> {creator, token, sale, avatarId, configHash}; role-gated setConfigHash
    AgentTokenFactory.sol  # one-tx launch: mint avatar, deploy token+sale, register
  test/
    AvatarNFT.t.sol
    AgentToken.t.sol
    BondingCurveSale.t.sol
    AgentRegistry.t.sol
    AgentTokenFactory.t.sol
  script/
    Deploy.s.sol           # deploys registry + factory, wires roles
  out/                     # forge build artifacts (ABIs) — git-ignored except exported subset
```

The app (Plans 2–4) consumes the deployed `AgentRegistry` + `AgentTokenFactory` addresses and the ABIs exported in Task 7.

---

### Task 0: Scaffold the Foundry project

**Files:**
- Create: `contracts/foundry.toml`, `contracts/remappings.txt`, `contracts/.env.example`, `contracts/.gitignore`

- [ ] **Step 1: Install Foundry (if missing) and verify**

Run:
```bash
curl -L https://foundry.paradigm.xyz | bash
~/.foundry/bin/foundryup
export PATH="$HOME/.foundry/bin:$PATH"
forge --version
```
Expected: prints a `forge Version: ...` line. (Add `~/.foundry/bin` to your shell profile so later steps see it.)

- [ ] **Step 2: Initialize the project and install OpenZeppelin**

Run:
```bash
cd /Users/samshow/Projects/aetherd
forge init contracts --no-git --no-commit
cd contracts
rm -f src/Counter.sol test/Counter.t.sol script/Counter.s.sol
forge install OpenZeppelin/openzeppelin-contracts@v5.1.0 --no-commit
```
Expected: `lib/openzeppelin-contracts` exists; no `Counter` files remain.

- [ ] **Step 3: Write `contracts/foundry.toml`**

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.24"
optimizer = true
optimizer_runs = 200
fs_permissions = [{ access = "read-write", path = "./out" }]

[rpc_endpoints]
base_sepolia = "${BASE_SEPOLIA_RPC_URL}"

[etherscan]
base_sepolia = { key = "${BASESCAN_API_KEY}", chain = 84532 }
```

- [ ] **Step 4: Write `contracts/remappings.txt`**

```
@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
forge-std/=lib/forge-std/src/
```

- [ ] **Step 5: Write `contracts/.env.example` and `contracts/.gitignore`**

`.env.example`:
```
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASESCAN_API_KEY=
DEPLOYER_PRIVATE_KEY=
EXECUTOR_ADDRESS=
```

`.gitignore`:
```
out/
cache/
broadcast/
.env
!out/aetherd-abis/
```

- [ ] **Step 6: Verify the toolchain compiles an empty build and commit**

Run:
```bash
forge build
```
Expected: `Compiling ...` then no errors (nothing to compile yet is fine).

```bash
cd /Users/samshow/Projects/aetherd
git add contracts/foundry.toml contracts/remappings.txt contracts/.env.example contracts/.gitignore contracts/lib
git commit -m "chore(contracts): scaffold Foundry project + OpenZeppelin v5"
```

---

### Task 1: AvatarNFT (ERC721, agentId = tokenId)

**Files:**
- Create: `contracts/src/AvatarNFT.sol`
- Test: `contracts/test/AvatarNFT.t.sol`

- [ ] **Step 1: Write the failing test**

`contracts/test/AvatarNFT.t.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AvatarNFT} from "../src/AvatarNFT.sol";

contract AvatarNFTTest is Test {
    AvatarNFT nft;
    address minter = address(0xBEEF);
    address user = address(0xCAFE);

    function setUp() public {
        nft = new AvatarNFT(address(this));
        nft.setMinter(minter, true);
    }

    function test_mint_incrementsTokenIdsFrom1() public {
        vm.prank(minter);
        uint256 id1 = nft.mint(user, "ipfs://a");
        vm.prank(minter);
        uint256 id2 = nft.mint(user, "ipfs://b");
        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(nft.ownerOf(1), user);
        assertEq(nft.tokenURI(2), "ipfs://b");
    }

    function test_mint_revertsForNonMinter() public {
        vm.prank(user);
        vm.expectRevert(AvatarNFT.NotMinter.selector);
        nft.mint(user, "ipfs://x");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd contracts && forge test --match-contract AvatarNFTTest`
Expected: FAIL — `AvatarNFT` source not found / does not compile.

- [ ] **Step 3: Write minimal implementation**

`contracts/src/AvatarNFT.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Avatar collection. tokenId doubles as the agentId across AeTherD.
contract AvatarNFT is ERC721, Ownable {
    error NotMinter();

    uint256 public nextId = 1;
    mapping(uint256 => string) private _uris;
    mapping(address => bool) public isMinter;

    constructor(address owner_) ERC721("AeTherD Avatar", "AVATAR") Ownable(owner_) {}

    function setMinter(address who, bool allowed) external onlyOwner {
        isMinter[who] = allowed;
    }

    function mint(address to, string calldata uri) external returns (uint256 id) {
        if (!isMinter[msg.sender]) revert NotMinter();
        id = nextId++;
        _safeMint(to, id);
        _uris[id] = uri;
    }

    function tokenURI(uint256 id) public view override returns (string memory) {
        _requireOwned(id);
        return _uris[id];
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd contracts && forge test --match-contract AvatarNFTTest -vv`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add contracts/src/AvatarNFT.sol contracts/test/AvatarNFT.t.sol
git commit -m "feat(contracts): AvatarNFT with minter-gated sequential mint"
```

---

### Task 2: AgentToken (ERC20Votes)

**Files:**
- Create: `contracts/src/AgentToken.sol`
- Test: `contracts/test/AgentToken.t.sol`

- [ ] **Step 1: Write the failing test**

`contracts/test/AgentToken.t.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentToken} from "../src/AgentToken.sol";

contract AgentTokenTest is Test {
    AgentToken token;
    address sale = address(0x5A1E);
    address holder = address(0x1234);

    function setUp() public {
        token = new AgentToken("Agent One", "AONE", sale, 1_000_000 ether);
    }

    function test_fullSupplyMintedToRecipient() public view {
        assertEq(token.totalSupply(), 1_000_000 ether);
        assertEq(token.balanceOf(sale), 1_000_000 ether);
    }

    function test_votingPowerRequiresDelegation() public {
        vm.prank(sale);
        token.transfer(holder, 100 ether);
        // Before delegation, no checkpointed votes.
        assertEq(token.getVotes(holder), 0);
        vm.prank(holder);
        token.delegate(holder);
        assertEq(token.getVotes(holder), 100 ether);
        // getPastVotes reads a historical block.
        vm.roll(block.number + 1);
        assertEq(token.getPastVotes(holder, block.number - 1), 100 ether);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd contracts && forge test --match-contract AgentTokenTest`
Expected: FAIL — `AgentToken` not found.

- [ ] **Step 3: Write minimal implementation**

`contracts/src/AgentToken.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";

/// @notice Governance token for one agent. Full supply minted to `recipient` (the sale).
contract AgentToken is ERC20, ERC20Permit, ERC20Votes {
    constructor(string memory name_, string memory symbol_, address recipient, uint256 supply)
        ERC20(name_, symbol_)
        ERC20Permit(name_)
    {
        _mint(recipient, supply);
    }

    // ---- Required overrides for ERC20Votes (OZ v5) ----
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Votes)
    {
        super._update(from, to, value);
    }

    function nonces(address owner) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd contracts && forge test --match-contract AgentTokenTest -vv`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add contracts/src/AgentToken.sol contracts/test/AgentToken.t.sol
git commit -m "feat(contracts): AgentToken ERC20Votes with full-supply mint"
```

---

### Task 3: BondingCurveSale (linear curve, exact integer math)

**Files:**
- Create: `contracts/src/BondingCurveSale.sol`
- Test: `contracts/test/BondingCurveSale.t.sol`

- [ ] **Step 1: Write the failing test**

`contracts/test/BondingCurveSale.t.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentToken} from "../src/AgentToken.sol";
import {BondingCurveSale} from "../src/BondingCurveSale.sol";

contract BondingCurveSaleTest is Test {
    AgentToken token;
    BondingCurveSale sale;

    uint256 constant P0 = 1e12;
    uint256 constant SLOPE = 1e6;
    uint256 constant MAX = 1_000_000;

    address alice = address(0xA11CE);

    function setUp() public {
        // Deploy sale first to know its address? Token mints to sale, so deploy token to a precomputed
        // address is overkill; instead deploy token to address(this), then move supply. Simpler: deploy
        // sale, then token minting to sale.
        sale = new BondingCurveSale(P0, SLOPE, MAX);
        token = new AgentToken("Agent", "AGT", address(sale), MAX * 1e18);
        sale.initialize(address(token));
        vm.deal(alice, 100 ether);
    }

    function test_costToBuyFirstToken_isP0() public view {
        assertEq(sale.costToBuy(1), P0);
    }

    function test_costToBuy_matchesTrapezoid() public view {
        // buying 3 tokens from sold=0: P0*3 + SLOPE*(0 + 1 + 2)
        uint256 expected = P0 * 3 + SLOPE * (0 + 1 + 2);
        assertEq(sale.costToBuy(3), expected);
    }

    function test_buy_transfersTokensAndRefundsExcess() public {
        uint256 cost = sale.costToBuy(10);
        uint256 balBefore = alice.balance;
        vm.prank(alice);
        sale.buy{value: cost + 1 ether}(10);
        assertEq(token.balanceOf(alice), 10 ether);
        assertEq(sale.sold(), 10);
        assertEq(address(sale).balance, cost); // reserve == areaUnder(10)
        assertEq(alice.balance, balBefore - cost); // excess refunded
    }

    function test_buyThenSell_roundTripsExactly() public {
        uint256 cost = sale.costToBuy(50);
        vm.prank(alice);
        sale.buy{value: cost}(50);
        vm.prank(alice);
        token.approve(address(sale), 50 ether);
        uint256 balBefore = alice.balance;
        vm.prank(alice);
        sale.sell(50);
        assertEq(token.balanceOf(alice), 0);
        assertEq(sale.sold(), 0);
        assertEq(address(sale).balance, 0);
        assertEq(alice.balance, balBefore + cost); // got exactly the ETH back
    }

    function test_buy_revertsOnInsufficientEth() public {
        uint256 cost = sale.costToBuy(5);
        vm.prank(alice);
        vm.expectRevert(BondingCurveSale.InsufficientEth.selector);
        sale.buy{value: cost - 1}(5);
    }

    function test_buy_revertsWhenExceedsMaxSupply() public {
        // Reverts on the supply check before the cost check; value must stay <= alice's funded balance.
        vm.prank(alice);
        vm.expectRevert(BondingCurveSale.ExceedsSupply.selector);
        sale.buy{value: 1 ether}(MAX + 1);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd contracts && forge test --match-contract BondingCurveSaleTest`
Expected: FAIL — `BondingCurveSale` not found.

- [ ] **Step 3: Write minimal implementation**

`contracts/src/BondingCurveSale.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Primary sale on a discrete linear bonding curve. Trades whole tokens; ETH math is exact.
contract BondingCurveSale {
    error InsufficientEth();
    error ExceedsSupply();
    error NotInitialized();
    error AlreadyInitialized();
    error TransferFailed();

    uint256 public immutable P0;
    uint256 public immutable SLOPE;
    uint256 public immutable MAX_SUPPLY; // whole tokens

    IERC20 public token;
    uint256 public sold; // whole tokens sold

    event Bought(address indexed buyer, uint256 amount, uint256 cost);
    event Sold(address indexed seller, uint256 amount, uint256 refund);

    constructor(uint256 p0, uint256 slope, uint256 maxSupply) {
        P0 = p0;
        SLOPE = slope;
        MAX_SUPPLY = maxSupply;
    }

    function initialize(address token_) external {
        if (address(token) != address(0)) revert AlreadyInitialized();
        token = IERC20(token_);
    }

    /// @dev Cumulative cost of selling the first `s` whole tokens. areaUnder(s) = P0*s + SLOPE*s*(s-1)/2.
    /// @dev Guards s==0: the (s-1) term would underflow on uint256 before the multiply-by-zero.
    function areaUnder(uint256 s) public view returns (uint256) {
        if (s == 0) return 0;
        return P0 * s + SLOPE * (s * (s - 1) / 2);
    }

    function costToBuy(uint256 amount) public view returns (uint256) {
        return areaUnder(sold + amount) - areaUnder(sold);
    }

    function refundToSell(uint256 amount) public view returns (uint256) {
        return areaUnder(sold) - areaUnder(sold - amount);
    }

    function buy(uint256 amount) external payable {
        if (address(token) == address(0)) revert NotInitialized();
        if (sold + amount > MAX_SUPPLY) revert ExceedsSupply();
        uint256 cost = costToBuy(amount);
        if (msg.value < cost) revert InsufficientEth();
        sold += amount;
        require(token.transfer(msg.sender, amount * 1e18), "token xfer");
        if (msg.value > cost) _send(msg.sender, msg.value - cost);
        emit Bought(msg.sender, amount, cost);
    }

    function sell(uint256 amount) external {
        if (amount > sold) revert ExceedsSupply();
        uint256 refund = refundToSell(amount);
        sold -= amount;
        require(token.transferFrom(msg.sender, address(this), amount * 1e18), "token xfer");
        _send(msg.sender, refund);
        emit Sold(msg.sender, amount, refund);
    }

    function _send(address to, uint256 value) private {
        (bool ok,) = to.call{value: value}("");
        if (!ok) revert TransferFailed();
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd contracts && forge test --match-contract BondingCurveSaleTest -vv`
Expected: PASS (6 tests).

- [ ] **Step 5: Add a fuzz invariant for round-trip solvency**

Append to `contracts/test/BondingCurveSale.t.sol` (inside the contract):
```solidity
    function testFuzz_buyThenSell_neverLosesEth(uint16 amount) public {
        vm.assume(amount > 0 && amount <= 1000);
        uint256 cost = sale.costToBuy(amount);
        vm.deal(alice, cost);
        vm.prank(alice);
        sale.buy{value: cost}(amount);
        vm.prank(alice);
        token.approve(address(sale), uint256(amount) * 1e18);
        vm.prank(alice);
        sale.sell(amount);
        assertEq(address(sale).balance, 0);
        assertEq(alice.balance, cost);
    }
```

Run: `cd contracts && forge test --match-contract BondingCurveSaleTest -vv`
Expected: PASS (7 tests, fuzz included).

- [ ] **Step 6: Commit**

```bash
git add contracts/src/BondingCurveSale.sol contracts/test/BondingCurveSale.t.sol
git commit -m "feat(contracts): linear BondingCurveSale with exact integer round-trip"
```

---

### Task 4: AgentRegistry (role-gated config anchoring)

**Files:**
- Create: `contracts/src/AgentRegistry.sol`
- Test: `contracts/test/AgentRegistry.t.sol`

- [ ] **Step 1: Write the failing test**

`contracts/test/AgentRegistry.t.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

contract AgentRegistryTest is Test {
    AgentRegistry reg;
    address registrar = address(0x111);
    address executor = address(0x222);
    address token = address(0x333);
    address sale = address(0x444);
    address creator = address(0x555);

    function setUp() public {
        reg = new AgentRegistry(address(this));
        reg.grantRole(reg.REGISTRAR_ROLE(), registrar);
        reg.grantRole(reg.EXECUTOR_ROLE(), executor);
    }

    function _register() internal {
        vm.prank(registrar);
        reg.register(1, creator, token, sale, 1, keccak256("v1"));
    }

    function test_register_storesAgentAndEmits() public {
        vm.expectEmit(true, true, false, true);
        emit AgentRegistry.AgentRegistered(1, creator, token, sale, 1, keccak256("v1"));
        _register();
        (address c, address t, address s, uint256 a, bytes32 h) = reg.agents(1);
        assertEq(c, creator);
        assertEq(t, token);
        assertEq(s, sale);
        assertEq(a, 1);
        assertEq(h, keccak256("v1"));
    }

    function test_register_revertsForNonRegistrar() public {
        vm.expectRevert();
        reg.register(1, creator, token, sale, 1, keccak256("v1"));
    }

    function test_setConfigHash_byExecutorUpdatesAndEmits() public {
        _register();
        vm.expectEmit(true, false, false, true);
        emit AgentRegistry.ConfigHashUpdated(1, keccak256("v1"), keccak256("v2"));
        vm.prank(executor);
        reg.setConfigHash(1, keccak256("v2"));
        (, , , , bytes32 h) = reg.agents(1);
        assertEq(h, keccak256("v2"));
    }

    function test_setConfigHash_revertsForNonExecutor() public {
        _register();
        vm.prank(creator);
        vm.expectRevert();
        reg.setConfigHash(1, keccak256("v2"));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd contracts && forge test --match-contract AgentRegistryTest`
Expected: FAIL — `AgentRegistry` not found.

- [ ] **Step 3: Write minimal implementation**

`contracts/src/AgentRegistry.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @notice Canonical on-chain record linking an agent to its token, sale, avatar, and config hash.
contract AgentRegistry is AccessControl {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    error UnknownAgent();
    error AlreadyRegistered();

    struct Agent {
        address creator;
        address token;
        address sale;
        uint256 avatarId;
        bytes32 configHash;
    }

    mapping(uint256 => Agent) public agents; // agentId => Agent

    event AgentRegistered(
        uint256 indexed agentId,
        address indexed creator,
        address token,
        address sale,
        uint256 avatarId,
        bytes32 configHash
    );
    event ConfigHashUpdated(uint256 indexed agentId, bytes32 oldHash, bytes32 newHash);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function register(
        uint256 agentId,
        address creator,
        address token,
        address sale,
        uint256 avatarId,
        bytes32 configHash
    ) external onlyRole(REGISTRAR_ROLE) {
        if (agents[agentId].token != address(0)) revert AlreadyRegistered();
        agents[agentId] = Agent(creator, token, sale, avatarId, configHash);
        emit AgentRegistered(agentId, creator, token, sale, avatarId, configHash);
    }

    function setConfigHash(uint256 agentId, bytes32 newHash) external onlyRole(EXECUTOR_ROLE) {
        Agent storage a = agents[agentId];
        if (a.token == address(0)) revert UnknownAgent();
        bytes32 old = a.configHash;
        a.configHash = newHash;
        emit ConfigHashUpdated(agentId, old, newHash);
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd contracts && forge test --match-contract AgentRegistryTest -vv`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add contracts/src/AgentRegistry.sol contracts/test/AgentRegistry.t.sol
git commit -m "feat(contracts): AgentRegistry with registrar/executor role gating"
```

---

### Task 5: AgentTokenFactory (one-tx launch)

**Files:**
- Create: `contracts/src/AgentTokenFactory.sol`
- Test: `contracts/test/AgentTokenFactory.t.sol`

- [ ] **Step 1: Write the failing test**

`contracts/test/AgentTokenFactory.t.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {AvatarNFT} from "../src/AvatarNFT.sol";
import {AgentTokenFactory} from "../src/AgentTokenFactory.sol";
import {AgentToken} from "../src/AgentToken.sol";
import {BondingCurveSale} from "../src/BondingCurveSale.sol";

contract AgentTokenFactoryTest is Test {
    AgentRegistry reg;
    AvatarNFT nft;
    AgentTokenFactory factory;
    address creator = address(0xC0FFEE);

    function setUp() public {
        reg = new AgentRegistry(address(this));
        nft = new AvatarNFT(address(this));
        factory = new AgentTokenFactory(address(reg), address(nft));
        reg.grantRole(reg.REGISTRAR_ROLE(), address(factory));
        nft.setMinter(address(factory), true);
    }

    function test_createAgent_deploysWiresAndRegisters() public {
        vm.prank(creator);
        (uint256 agentId, address token, address sale) =
            factory.createAgent("Agent One", "AONE", "ipfs://avatar", keccak256("v1"));

        assertEq(agentId, 1);
        assertEq(nft.ownerOf(1), creator);

        // Registry wired correctly.
        (address c, address t, address s, uint256 a, bytes32 h) = reg.agents(1);
        assertEq(c, creator);
        assertEq(t, token);
        assertEq(s, sale);
        assertEq(a, 1);
        assertEq(h, keccak256("v1"));

        // Sale holds full supply and is initialized.
        assertEq(AgentToken(token).balanceOf(sale), 1_000_000 ether);
        assertEq(address(BondingCurveSale(sale).token()), token);

        // A buy works end-to-end through the freshly launched sale.
        uint256 cost = BondingCurveSale(sale).costToBuy(1);
        vm.deal(creator, 1 ether);
        vm.prank(creator);
        BondingCurveSale(sale).buy{value: cost}(1);
        assertEq(AgentToken(token).balanceOf(creator), 1 ether);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd contracts && forge test --match-contract AgentTokenFactoryTest`
Expected: FAIL — `AgentTokenFactory` not found.

- [ ] **Step 3: Write minimal implementation**

`contracts/src/AgentTokenFactory.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AgentRegistry} from "./AgentRegistry.sol";
import {AvatarNFT} from "./AvatarNFT.sol";
import {AgentToken} from "./AgentToken.sol";
import {BondingCurveSale} from "./BondingCurveSale.sol";

/// @notice Launches an agent in one tx: mint avatar, deploy token+sale, register.
contract AgentTokenFactory {
    uint256 public constant P0 = 1e12;
    uint256 public constant SLOPE = 1e6;
    uint256 public constant MAX_SUPPLY = 1_000_000; // whole tokens

    AgentRegistry public immutable registry;
    AvatarNFT public immutable avatars;

    event AgentCreated(uint256 indexed agentId, address indexed creator, address token, address sale);

    constructor(address registry_, address avatars_) {
        registry = AgentRegistry(registry_);
        avatars = AvatarNFT(avatars_);
    }

    function createAgent(
        string calldata name,
        string calldata symbol,
        string calldata avatarURI,
        bytes32 configHash
    ) external returns (uint256 agentId, address token, address sale) {
        agentId = avatars.mint(msg.sender, avatarURI);

        BondingCurveSale s = new BondingCurveSale(P0, SLOPE, MAX_SUPPLY);
        AgentToken t = new AgentToken(name, symbol, address(s), MAX_SUPPLY * 1e18);
        s.initialize(address(t));

        registry.register(agentId, msg.sender, address(t), address(s), agentId, configHash);

        emit AgentCreated(agentId, msg.sender, address(t), address(s));
        return (agentId, address(t), address(s));
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd contracts && forge test --match-contract AgentTokenFactoryTest -vv`
Expected: PASS (1 test).

- [ ] **Step 5: Run the full suite**

Run: `cd contracts && forge test -vv`
Expected: PASS — all tests across all 5 contracts.

- [ ] **Step 6: Commit**

```bash
git add contracts/src/AgentTokenFactory.sol contracts/test/AgentTokenFactory.t.sol
git commit -m "feat(contracts): AgentTokenFactory one-tx agent launch"
```

---

### Task 6: Deploy script (registry + factory, role wiring)

**Files:**
- Create: `contracts/script/Deploy.s.sol`

- [ ] **Step 1: Write the deploy script**

`contracts/script/Deploy.s.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {AvatarNFT} from "../src/AvatarNFT.sol";
import {AgentTokenFactory} from "../src/AgentTokenFactory.sol";

contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address executor = vm.envAddress("EXECUTOR_ADDRESS");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);
        AgentRegistry registry = new AgentRegistry(deployer);
        AvatarNFT avatars = new AvatarNFT(deployer);
        AgentTokenFactory factory = new AgentTokenFactory(address(registry), address(avatars));

        registry.grantRole(registry.REGISTRAR_ROLE(), address(factory));
        registry.grantRole(registry.EXECUTOR_ROLE(), executor);
        avatars.setMinter(address(factory), true);
        vm.stopBroadcast();

        console.log("AgentRegistry:", address(registry));
        console.log("AvatarNFT:", address(avatars));
        console.log("AgentTokenFactory:", address(factory));
    }
}
```

- [ ] **Step 2: Dry-run the deploy against a local Anvil fork**

Run (in one terminal): `anvil`
Run (in another):
```bash
cd contracts
DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
EXECUTOR_ADDRESS=0x70997970C51812dc3A010C7d01b50e0d17dc79C8 \
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```
Expected: prints the three deployed addresses, no revert. Stop anvil afterward.

- [ ] **Step 3: Commit**

```bash
git add contracts/script/Deploy.s.sol
git commit -m "feat(contracts): Deploy script wiring registry/factory/avatar roles"
```

---

### Task 7: Export ABIs + addresses for the app

**Files:**
- Create: `contracts/script/export-abis.sh`
- Create (generated): `contracts/out/aetherd-abis/{AgentRegistry,AgentTokenFactory,AgentToken,BondingCurveSale,AvatarNFT}.json`
- Create: `contracts/out/aetherd-abis/addresses.base-sepolia.json` (filled after real testnet deploy)

- [ ] **Step 1: Write the export script**

`contracts/script/export-abis.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
forge build
OUT=out/aetherd-abis
mkdir -p "$OUT"
for c in AgentRegistry AgentTokenFactory AgentToken BondingCurveSale AvatarNFT; do
  jq '.abi' "out/$c.sol/$c.json" > "$OUT/$c.json"
  echo "exported $OUT/$c.json"
done
```

- [ ] **Step 2: Run it and verify ABIs exist**

Run:
```bash
cd contracts && chmod +x script/export-abis.sh && ./script/export-abis.sh
ls out/aetherd-abis
```
Expected: five `*.json` ABI files listed.

- [ ] **Step 3: Add an addresses placeholder for Base Sepolia**

`contracts/out/aetherd-abis/addresses.base-sepolia.json`:
```json
{
  "chainId": 84532,
  "AgentRegistry": "",
  "AvatarNFT": "",
  "AgentTokenFactory": ""
}
```
(Fill the three values from a real `forge script ... --rpc-url base_sepolia --broadcast --verify` deploy when you have a funded deployer + Basescan key. The app's Plan 2 reads this file.)

- [ ] **Step 4: Commit**

```bash
git add contracts/script/export-abis.sh contracts/out/aetherd-abis
git commit -m "chore(contracts): export ABIs + Base Sepolia addresses manifest for the app"
```

---

## Self-Review

**Spec coverage (against §3 contracts + §5 anchoring of the design spec):**
- `AgentRegistry` (agentId → {creator, token, sale, avatarId, configHash}, `setConfigHash` gated to `EXECUTOR_ROLE`, events) → Task 4. ✔
- `AgentTokenFactory` (one-tx deploy + mint + register) → Task 5. ✔
- `AgentToken` (ERC20Votes, fixed supply to sale) → Task 2. ✔
- `BondingCurveSale` (buy/sell vs test ETH, reserve) → Task 3. ✔
- `AvatarNFT` (ERC721, minted at launch, tokenURI) → Task 1. ✔
- On-chain config anchoring used by the Executor (Plan 4) → `setConfigHash` + `ConfigHashUpdated` event (Task 4). ✔
- DEX graduation intentionally **out of scope** (spec §8) — not in this plan. ✔
- ABIs/addresses handed to the app → Task 7. ✔

**Placeholder scan:** No "TBD/handle errors later" steps; every code step shows full source. The Base Sepolia address JSON is intentionally empty until a funded deploy — labeled as such, and the app's Plan 2 reads it.

**Type consistency:** `register(agentId, creator, token, sale, avatarId, configHash)` signature is identical in `AgentRegistry` (Task 4), its tests, and the factory call (Task 5). `costToBuy`/`refundToSell`/`areaUnder`/`sold`/`buy`/`sell` names match between `BondingCurveSale` and all its callers/tests. `createAgent(name, symbol, avatarURI, configHash) → (agentId, token, sale)` matches between factory and test. Curve constants `P0=1e12`, `SLOPE=1e6`, `MAX_SUPPLY=1_000_000` are identical in the sale, the factory, and the tests.
