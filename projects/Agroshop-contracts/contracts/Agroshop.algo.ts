import { Contract } from '@algorandfoundation/tealscript';

// this variable or type which holds or describe the ID(owner and assetID) of selable item in the BoxMap. the owner and the Asset to be sold
type forSaleID = { owner: Address; asset: AssetID; nonce: uint64 }; // nonce is used to define a key of a sale whatever that means. it can be used to maybe set a diff price for half of the assets

// every sale is compose of information like the dep. amount, unitPrice, bidder or buyer Adress, etc
type forSaleInfo = {
  deposited: uint64;
  unitaryPrice: uint64;
};
// key -> value === (Address, UInt64, UInt64) -> (UInt64, UInt64, Address, UInt64, UInt64)
// === (32 + 8 + 8) -> (8 + 8 + 32 + 8 + 8) === 48 -> 64 === 112 B
// 2_500 + (400 * 112) === 47_300 microALGO === 0.0473 ALGO
// Per Box created = 0.0025 mAlgo -> Per byte in box created = 0.0004 mAlgo

const forSaleMbr = 2_500 + 400 * 112; // ??

// here the contract is going to be the constodial for all assets of all users: meaning no user is going to hold any asset that it wants to sell (list)
export class Agroshop extends Contract {
  // listings which is a BoxMap holds all the asset that are to be sold
  listings = BoxMap<forSaleID, forSaleInfo>();

  public allowAsset(mbrPay: PayTxn, asset: AssetID) {
    assert(!this.app.address.isOptedInToAsset(asset));

    verifyPayTxn(mbrPay, {
      receiver: this.app.address,
      amount: globals.assetOptInMinBalance,
    });

    sendAssetTransfer({
      xferAsset: asset,
      assetAmount: 0,
      assetReceiver: this.app.address,
    });
  }

  public listingDeposit(mbrPay: PayTxn, xfer: AssetTransferTxn, nonce: uint64, unitaryPrice: uint64) {
    assert(!this.listings({ owner: this.txn.sender, asset: xfer.xferAsset, nonce: nonce }).exists); // making sure the listing doesnt exist yet

    verifyPayTxn(mbrPay, {
      sender: this.txn.sender,
      receiver: this.app.address,
      amount: forSaleMbr,
    });

    verifyAssetTransferTxn(xfer, {
      sender: this.txn.sender,
      assetReceiver: this.app.address,
      assetAmount: { greaterThan: 0 },
    });

    this.listings({ owner: this.txn.sender, asset: xfer.xferAsset, nonce: nonce }).value = {
      deposited: xfer.assetAmount,
      unitaryPrice: unitaryPrice,
    };
  }

  public deposit(xfer: AssetTransferTxn, nonce: uint64) {
    assert(this.listings({ owner: this.txn.sender, asset: xfer.xferAsset, nonce: nonce }).exists);

    verifyAssetTransferTxn(xfer, {
      sender: this.txn.sender,
      assetReceiver: this.app.address,
      assetAmount: { greaterThan: 0 },
    });
    // here we are getting the content of the listings box so that we can easily overide it.
    const currentDeposited = this.listings({ owner: this.txn.sender, asset: xfer.xferAsset, nonce: nonce }).value
      .deposited;
    const currentUnitaryPrice = this.listings({ owner: this.txn.sender, asset: xfer.xferAsset, nonce: nonce }).value
      .unitaryPrice;

    // we are now ovwriding only the deposited value
    this.listings({ owner: this.txn.sender, asset: xfer.xferAsset, nonce: nonce }).value = {
      deposited: currentDeposited + xfer.assetAmount,
      unitaryPrice: currentUnitaryPrice,
    };
  }

  public setPrice(asset: AssetID, nonce: uint64, unitaryPrice: uint64) {
    const currentDeposited = this.listings({ owner: this.txn.sender, asset: asset, nonce: nonce }).value.deposited;

    this.listings({ owner: this.txn.sender, asset: asset, nonce: nonce }).value = {
      deposited: currentDeposited,
      unitaryPrice: unitaryPrice,
    };
  }

  public buy(owner: Address, asset: AssetID, nonce: uint64, buyPay: PayTxn, quantity: uint64) {
    const currentDeposited = this.listings({ owner: owner, asset: asset, nonce: nonce }).value.deposited;
    const currentUnitaryPrice = this.listings({ owner: owner, asset: asset, nonce: nonce }).value.unitaryPrice;
    // the wideRatio takes care of multiplication and maybe even ratio overflow
    const amountToBePaid = currentUnitaryPrice * quantity;

    verifyPayTxn(buyPay, {
      sender: this.txn.sender,
      receiver: owner,
    });
    sendAssetTransfer({
      xferAsset: asset,
      assetReceiver: this.txn.sender,
      assetAmount: quantity,
    });

    this.listings({ owner: owner, asset: asset, nonce: nonce }).value = {
      deposited: currentDeposited - quantity,
      unitaryPrice: currentUnitaryPrice,
    };
  }

  public withdraw(asset: AssetID, nonce: uint64) {
    const currentDeposited = this.listings({ owner: this.txn.sender, asset: asset, nonce: nonce }).value.deposited;

    this.listings({ owner: this.txn.sender, asset: asset, nonce: nonce }).delete();

    sendPayment({
      receiver: this.txn.sender,
      amount: forSaleMbr,
    });

    sendAssetTransfer({
      xferAsset: asset,
      assetReceiver: this.txn.sender,
      assetAmount: currentDeposited,
    });
  }
}
