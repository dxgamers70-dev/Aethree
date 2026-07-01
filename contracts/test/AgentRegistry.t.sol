// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";

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
        (,,,, bytes32 h) = reg.agents(1);
        assertEq(h, keccak256("v2"));
    }

    function test_setConfigHash_revertsForNonExecutor() public {
        _register();
        vm.prank(creator);
        vm.expectRevert();
        reg.setConfigHash(1, keccak256("v2"));
    }
}
