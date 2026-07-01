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
