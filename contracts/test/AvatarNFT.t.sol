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
