// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AgentTokenFactory} from "../src/AgentTokenFactory.sol";

/// A contract account that does NOT implement onERC721Received — mimics a smart
/// wallet that can't receive a _safeMint'd NFT.
contract DumbWallet {
    function launch(AgentTokenFactory factory, IERC20 aeon, uint256 seed) external {
        aeon.approve(address(factory), seed);
        factory.createAgent("Degen", "DEGE", "ipfs://x", bytes32(uint256(1)), seed);
    }
}

/// A contract account that DOES implement the receiver hook — should succeed.
contract SmartWalletWithReceiver {
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function launch(AgentTokenFactory factory, IERC20 aeon, uint256 seed) external {
        aeon.approve(address(factory), seed);
        factory.createAgent("Degen", "DEGE", "ipfs://x", bytes32(uint256(1)), seed);
    }
}

/// Reproduces the live `createAgent` revert (0x64a0ae92 = ERC721InvalidReceiver)
/// when the creator is a contract wallet lacking onERC721Received.
contract MainnetForkSmartWalletTest is Test {
    AgentTokenFactory constant FACTORY = AgentTokenFactory(0x758c73C9e22639F4fe54301D039e155Dc7380B8c);
    IERC20 constant AEON = IERC20(0xBf8E8f0e8866a7052F948C16508644347c57aba3);

    /// After the _mint fix, a contract wallet WITHOUT onERC721Received can launch
    /// (this used to revert with 0x64a0ae92 = ERC721InvalidReceiver).
    function test_contractWalletWithoutReceiver_succeeds() public {
        if (block.chainid != 8453) { vm.skip(true); return; }
        uint256 seed = FACTORY.MIN_SEED();
        DumbWallet w = new DumbWallet();
        deal(address(AEON), address(w), seed);
        w.launch(FACTORY, AEON, seed); // should NOT revert anymore
    }

    function test_contractWalletWithReceiver_succeeds() public {
        if (block.chainid != 8453) { vm.skip(true); return; }
        uint256 seed = FACTORY.MIN_SEED();
        SmartWalletWithReceiver w = new SmartWalletWithReceiver();
        deal(address(AEON), address(w), seed);
        w.launch(FACTORY, AEON, seed); // should not revert
    }
}
