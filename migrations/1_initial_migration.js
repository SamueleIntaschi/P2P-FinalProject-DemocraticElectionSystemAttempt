const Mayor = artifacts.require("Mayor");

// Informations to create the contract

var candidates = [
    "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
    "0xF076E015a43B8d4510b64CD7302B7a7d127874Fd",
    "0x48A9f868446130A896D73BC84d0447eb3b17bD07",
    "0xf22F913131989234020AfaAb74bE4434F8D996EC",
    "0xFaf9ebB1e5DE09aB161620a612053562f568dE9c",
    "0xCEEDBEAF084AE3A44427E0Cab3171A22dD161106",
    "0x542392b415B3762A95088151e068799f7577a44F",
    "0xc13F2467E44FF13c01a9eF5F1cd9ADc4C5468615",
    "0x8aF2dF23C48259BBD95C84873163d752938A7f32",
    "0xE96AB844BAC663e1924Df3ae2249F03F8d01d975"
];
var escrow = "0x0472ec0185ebb8202f3d4ddb0226998889663cf2";
var quorum = 3;

module.exports = async function (deployer, network, accounts) {
    await deployer.deploy(Mayor, candidates, escrow, quorum, {from: accounts[quorum]});
};