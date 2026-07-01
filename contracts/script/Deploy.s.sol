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
