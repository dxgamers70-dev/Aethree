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

    function test_initialize_revertsForNonInitializer() public {
        BondingCurveSale fresh = new BondingCurveSale(
            address(aeon), creator, treasury, platform, P0, SLOPE, MAX, V
        );
        AgentToken t2 = new AgentToken("X", "X", address(fresh), MAX * 1e18);
        vm.prank(alice);
        vm.expectRevert(BondingCurveSale.NotInitializer.selector);
        fresh.initialize(address(t2), SEED);
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
