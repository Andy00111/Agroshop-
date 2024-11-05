import { describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing';
import * as algokit from '@algorandfoundation/algokit-utils';
import { AgroshopClient } from '../contracts/clients/AgroshopClient'
import {
  algos,
  getAccountAddressAsUint8Array,
  getOrCreateKmdWalletAccount,
  microAlgos,
} from '@algorandfoundation/algokit-utils';
import { decodeUint64, encodeUint64 } from 'algosdk';

const fixture = algorandFixture();
algokit.Config.configure({ populateAppCallResources: true });

let appClient: AgroshopClient;
const forSaleMbr = 2_500 + 400 * 112;

describe('AgroshopClient', () => {
  beforeEach(fixture.beforeEach);

  let testAssetsId: [number | bigint, number | bigint]; // this is kind of a global variable that can be accesed from all the tests

  beforeAll(async () => {
    await fixture.beforeEach();
    const { testAccount } = fixture.context;
    const { algorand } = fixture;
    // these accounts are going to be new in each test run but will be same for each test unit
    // NOTE: we are getting or Creating (mostly) the KMD account not getting(declaring initializing)
    await getOrCreateKmdWalletAccount(
      { name: 'stableSeller', fundWith: algos(10) },
      algorand.client.algod,
      algorand.client.kmd
    );
    await getOrCreateKmdWalletAccount(
      { name: 'transporter', fundWith: algos(10) },
      algorand.client.algod,
      algorand.client.kmd
    );
    await getOrCreateKmdWalletAccount(
      { name: 'buyer', fundWith: algos(10) },
      algorand.client.algod,
      algorand.client.kmd
    );
    console.log("Accouns have been Created or Goten =")
    // here we get or retreived the created account from KMD
    // Note: here we are getting the account from algorand client not from algokit otherwise we will just assign a variable just b4 the await of getOrCreate
    const stableSeller = await algorand.account.fromKmd('stableSeller');

    // here we are creating a Promise that is resolved with an array of results when all of the provided Promises resolve, or rejected when any Promise is rejected.
    testAssetsId = await Promise.all([
      (
        await algorand.send.assetCreate({
          sender: stableSeller.addr,
          total: BigInt(10),
        })
      ).confirmation.assetIndex!,
      (
        await algorand.send.assetCreate({
          sender: stableSeller.addr,
          total: BigInt(10),
        })
      ).confirmation.assetIndex!,
    ]);
    console.log("Assets have been created =")
    appClient = new AgroshopClient(
      {
        sender: testAccount,
        resolveBy: 'id',
        id: 0,
      },
      algorand.client.algod
    );

    await appClient.create.createApplication({});
    // here we are funding the account with just enough algos to be on the ledger (mbr)
    // this happens only once ands its at the time of creation
    // Note: any other tranction fee will have to paid by the sender
    await appClient.appClient.fundAppAccount(algos(0.1));
    console.log("App is created and funded =")
  });

  test('allowAsset', async () => {
    const { algorand } = fixture; // here we are bringing the algorand client so that we can get the created accounts and assets
    const stableSeller = await algorand.account.fromKmd('stableSeller');
    const { appAddress } = await appClient.appClient.getAppReference();

    // just a test
    await Promise.all(
      // here we are iterating over the test assets
      testAssetsId.map(async (asset) => {
        // here we are trying to get asset information from the app but the app has not opted in to the asset
        await expect(algorand.account.getAssetInformation(appAddress, asset)).rejects.toBeDefined();
      })
    );
    // Opting the assets to the contract
    const results = await Promise.all(
      // here we are iterating over the assetsID and Opting the app to each assset
      testAssetsId.map(async (asset) =>
        appClient.allowAsset(
          {
            // this tx is paying for the mbr of the asset we want to optIn. the extraFee is for the inner tx
            mbrPay: await algorand.transactions.payment({
              sender: stableSeller.addr,
              receiver: appAddress,
              amount: algos(0.1),
              extraFee: microAlgos(1_000),
            }),
            asset,
          },
          { sender: stableSeller }
        )
      )
    );
    // macking sure that the transaction is comfirmed
    results.map((result) => expect(result.confirmation).toBeDefined());
    console.log("App optedIn to the 2 Assets created =")

    await Promise.all(
      // here we are iterating over the test assets
      testAssetsId.map(async (asset) => {
        // here we are trying to get asset information, and we expect it to be 0 balance since we didnt deposited (listed), we only optIn
        await expect(algorand.account.getAssetInformation(appAddress, asset)).resolves.toEqual(
          expect.objectContaining({
            assetId: BigInt(asset),
            balance: BigInt(0),
          })
        );
      })
    );
    console.log("Now we can deposit the assets ammounts = 3000 ")
  });

  test('listingDeposit', async () => {
    const { algorand } = fixture;
    const stableSeller = await algorand.account.fromKmd('stableSeller');
    const { appAddress } = await appClient.appClient.getAppReference();

    const results = await Promise.all(
      // here we are iterating over the test assets and listinning(depositing the asset)
      testAssetsId.map(async (asset) =>
        appClient.listingDeposit(
          {
            // this MBR tx is paying for the box storage and byte in box created
            mbrPay: await algorand.transactions.payment({
              sender: stableSeller.addr,
              receiver: appAddress,
              amount: microAlgos(forSaleMbr),
            }),
            xfer: await algorand.transactions.assetTransfer({
              assetId: BigInt(asset),
              sender: stableSeller.addr,
              receiver: appAddress,
              amount: 3n,
            }),
            nonce: 0,
            unitaryPrice: algos(1).microAlgos,
          },
          { sender: stableSeller }
        )
      )
    );
    results.map((result) => expect(result.confirmation).toBeDefined());
    console.log("Assets have been deposited =")
    // after depositing(listing) we then check the ballance of each asset
    await Promise.all(
      testAssetsId.map(async (asset) => {
        await expect(algorand.account.getAssetInformation(appAddress, asset)).resolves.toEqual(
          expect.objectContaining({
            assetId: BigInt(asset),
            balance: BigInt(3),
          })
        );
      })
    );
    console.log("Getting Box Content")
    await Promise.all(
      testAssetsId.map(async (asset) => {
        const boxContent = await appClient.appClient.getBoxValue(
          new Uint8Array([
            ...getAccountAddressAsUint8Array(stableSeller.addr),
            ...encodeUint64(asset),
            ...encodeUint64(0),
          ])
        );
        const assetDeposited = decodeUint64(boxContent.slice(0, 8), 'safe');
        const assetUnitaryPrice = decodeUint64(boxContent.slice(8, 16), 'safe');
        expect(assetDeposited).toEqual(3);
        expect(assetUnitaryPrice).toEqual(algos(1).microAlgos);
        console.log("Box Content: AssetsUnit = "+assetDeposited+" AssetUnitaryPrice = "+assetUnitaryPrice)
      })
    );
  });

  test('deposit', async () => {
    const { algorand } = fixture;
    const stableSeller = await algorand.account.fromKmd('stableSeller');
    const { appAddress } = await appClient.appClient.getAppReference();

    const results = await Promise.all(
      // here we are iterating over the test assets and listinning(depositing the asset)
      testAssetsId.map(async (asset) =>
        appClient.deposit(
          {
            xfer: await algorand.transactions.assetTransfer({
              assetId: BigInt(asset),
              sender: stableSeller.addr,
              receiver: appAddress,
              amount: 3n,
            }),
            nonce: 0,
          },
          { sender: stableSeller }
        )
      )
    );
    results.map((result) => expect(result.confirmation).toBeDefined());
    console.log("Assets have been deposited =")
    // after depositing(listing) we then check the ballance of each asset
    await Promise.all(
      testAssetsId.map(async (asset) => {
        await expect(algorand.account.getAssetInformation(appAddress, asset)).resolves.toEqual(
          expect.objectContaining({
            assetId: BigInt(asset),
            balance: BigInt(6),
          })
        );
      })
    );
    console.log("Getting Box Content")
    await Promise.all(
      testAssetsId.map(async (asset) => {
        const boxContent = await appClient.appClient.getBoxValue(
          new Uint8Array([
            ...getAccountAddressAsUint8Array(stableSeller.addr),
            ...encodeUint64(asset),
            ...encodeUint64(0),
          ])
        );
        const assetDeposited = decodeUint64(boxContent.slice(0, 8), 'safe');
        const assetUnitaryPrice = decodeUint64(boxContent.slice(8, 16), 'safe');
        expect(assetDeposited).toEqual(6);
        expect(assetUnitaryPrice).toEqual(algos(1).microAlgos);
        console.log("Box Content: AssetsUnit = "+assetDeposited+" AssetUnitaryPrice = "+assetUnitaryPrice)
      })
    );
  });

  test('setPrice', async () => {
    const { algorand } = fixture;
    const stableSeller = await algorand.account.fromKmd('stableSeller');

    const results = await Promise.all(
      [
        // weg get the AssetID tha we want to change the price and we set the new price in microAlgos
        [testAssetsId[0], algos(1.5).microAlgos],
        [testAssetsId[1], algos(1.5).microAlgos],
        // here we are mapping over the array or tuples
      ].map(async ([asset, unitaryPrice]) =>
        // now we use the appClient to set the price of each asset with the predefined price above
        appClient.setPrice(
          {
            asset,
            nonce: 0,
            unitaryPrice,
          },
          { sender: stableSeller }
        )
      )
    );

    results.map((result) => expect(result.confirmation).toBeDefined());
    console.log("price has been set =")

    // here we are just checking wether the price in the BoxMap is updated
    await Promise.all(
      [
        [testAssetsId[0], algos(1.5).microAlgos],
        [testAssetsId[1], algos(1.5).microAlgos],
      ].map(async ([asset, unitaryPrice]) => {
        const boxContent = await appClient.appClient.getBoxValue(
          new Uint8Array([
            ...getAccountAddressAsUint8Array(stableSeller.addr),
            ...encodeUint64(asset),
            ...encodeUint64(0),
          ])
        );
        const boxUnitaryPrice = decodeUint64(boxContent.slice(8, 16), 'safe');
        expect(boxUnitaryPrice).toEqual(unitaryPrice);
        console.log("Asset New Price = "+boxUnitaryPrice)
      })
    );
  });

  test('buy', async () => {
    const { algorand } = fixture;
    const stableSeller = await algorand.account.fromKmd('stableSeller');
    const buyer = await algorand.account.fromKmd('buyer');

    // here we optin the buyer cox he hasnt opted in b4
    await Promise.all(
      // we are opting the buyer to all the assets
      testAssetsId.map(async (asset) =>
        algorand.send.assetOptIn({
          assetId: BigInt(asset),
          sender: buyer.addr,
        })
      )
    );
    console.log("Buyer opted In = ")
    const results = await Promise.all(
      [
        // weg get the AssetID tha we want to buy set the quantity we want and the amountTopay
        [testAssetsId[0], 2, 0.75],
        [testAssetsId[1], 2, 0.75],
      ].map(async ([asset, quantity, amountToPay]) =>
        appClient.buy(
          {
            owner: stableSeller.addr,
            asset,
            nonce: 0,
            buyPay: await algorand.transactions.payment({
              sender: buyer.addr,
              receiver: stableSeller.addr,
              amount: algos(Number(amountToPay)),
              extraFee: microAlgos(1_000), // for inner tx
            }),
            quantity: quantity,
          },
          { sender: buyer }
        )
      )
    );

    results.map((result) => expect(result.confirmation).toBeDefined());
    console.log("Buyer buys 1 + 1 assets for 3 algos")

    await Promise.all(
      testAssetsId.map(async (asset) => {
        await expect(algorand.account.getAssetInformation(buyer.addr, asset)).resolves.toEqual(
          expect.objectContaining({
            assetId: BigInt(asset),
            balance: BigInt(2),
          })
        );
      })
    );
  });

});
