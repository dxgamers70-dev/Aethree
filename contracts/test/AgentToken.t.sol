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
