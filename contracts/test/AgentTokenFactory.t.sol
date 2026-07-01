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
