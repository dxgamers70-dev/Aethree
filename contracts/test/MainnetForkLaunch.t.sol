// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AgentTokenFactory} from "../src/AgentTokenFactory.sol";
import {AgentToken} from "../src/AgentToken.sol";
import {BondingCurveSale} from "../src/BondingCurveSale.sol";
import {AvatarNFT} from "../src/AvatarNFT.sol";

/// @notice End-to-end test of the launchpad token-deployment flow against the
/// REAL contracts deployed on Base mainnet (run with --fork-url base mainnet).
contract MainnetForkLaunchTest is Test {
    // Live Base mainnet deployment (chainId 8453).
    AgentTokenFactory constant FACTORY = AgentTokenFactory(0x758c73C9e22639F4fe54301D039e155Dc7380B8c);
    AvatarNFT constant AVATARS = AvatarNFT(0xf5F498eA77C0bd95f933a76212063BB5814C90e1);
    IERC20 constant AEON = IERC20(0xBf8E8f0e8866a7052F948C16508644347c57aba3);

    address user = makeAddr("creator");

    function test_endToEnd_launchThenBuyThenSell() public {
        // Only runs against a Base mainnet fork (forge test --fork-url ...); skipped otherwise.
        if (block.chainid != 8453) {
            vm.skip(true);
            return;
        }
        // Sanity: the factory is the live one.
        assertEq(address(FACTORY.aeon()), address(AEON), "factory not wired to real AEON");

        uint256 seed = FACTORY.MIN_SEED(); // 100,000 AEON

        // Fund the creator with AEON (fork-only; real chain untouched).
        deal(address(AEON), user, seed * 2);
        assertEq(AEON.balanceOf(user), seed * 2);

        // --- 1) Launch: createAgent in one tx ---
        vm.startPrank(user);
        AEON.approve(address(FACTORY), seed);
        (uint256 agentId, address token, address sale) =
            FACTORY.createAgent("Fork Test Agent", "FORK", "ipfs://avatar", bytes32(uint256(0xABC)), seed);
        vm.stopPrank();

        console.log("agentId:", agentId);
        console.log("token:  ", token);
        console.log("sale:   ", sale);

        assertTrue(agentId > 0, "no agentId");
        assertTrue(token != address(0), "no token");
        assertTrue(sale != address(0), "no sale");

        // Avatar NFT minted to creator; token fully minted to the sale; seed parked in the sale.
        assertEq(AVATARS.ownerOf(agentId), user, "avatar not owned by creator");
        assertEq(AgentToken(token).totalSupply(), FACTORY.MAX_SUPPLY() * 1e18, "wrong token supply");
        assertEq(IERC20(token).balanceOf(sale), FACTORY.MAX_SUPPLY() * 1e18, "sale should hold full supply");
        assertEq(AEON.balanceOf(sale), seed, "seed not parked in sale");

        // --- 2) Buy 1,000 tokens off the curve ---
        BondingCurveSale s = BondingCurveSale(sale);
        uint256 amount = 1_000;
        uint256 cost = s.costToBuy(amount);
        console.log("cost to buy 1000:", cost);

        vm.startPrank(user);
        AEON.approve(sale, cost);
        s.buy(amount);
        vm.stopPrank();

        assertEq(IERC20(token).balanceOf(user), amount * 1e18, "buyer didn't receive tokens");

        // --- 3) Sell them back at the floor ---
        uint256 aeonBefore = AEON.balanceOf(user);
        uint256 payout = s.quoteSell(amount);
        console.log("sell payout:", payout);

        vm.startPrank(user);
        IERC20(token).approve(sale, amount * 1e18);
        s.sell(amount);
        vm.stopPrank();

        assertEq(IERC20(token).balanceOf(user), 0, "tokens not returned on sell");
        assertEq(AEON.balanceOf(user), aeonBefore + payout, "AEON payout mismatch");
        assertTrue(payout <= cost, "sell should never profit vs buy (floor <= buy price)");

        console.log("END-TO-END OK: launch -> buy -> sell against live mainnet contracts");
    }
}
