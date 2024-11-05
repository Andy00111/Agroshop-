// src/components/Home.tsx
import { Config as AlgokitConfig, microAlgos } from '@algorandfoundation/algokit-utils'
import AlgorandClient from '@algorandfoundation/algokit-utils/types/algorand-client'
import { useWallet } from '@txnlab/use-wallet'
import algosdk, { decodeAddress, decodeUint64, encodeAddress, encodeUint64 } from 'algosdk'
import React, { useState } from 'react'
import ConnectWallet from './components/ConnectWallet'
import MethodCall from './components/MethodCall'
import { AgroshopClient } from './contracts/Agroshop'
import * as methods from './methods'
import { getAlgodConfigFromViteEnvironment } from './utils/network/getAlgoClientConfigs'
import { useQuery } from '@tanstack/react-query'

interface HomeProps {}

const Home: React.FC<HomeProps> = () => {
  AlgokitConfig.configure({ populateAppCallResources: true })

  const [openWalletModal, setOpenWalletModal] = useState<boolean>(false)
  const [appId, setAppId] = useState<number>(0)
  const [amountToSell, setAmountToSell] = useState<bigint>(0n)
  const [sellingPrice, setSellingPrice] = useState<bigint>(0n)
  const listingsQuery = useQuery({
    queryKey: ['listings', appId],
    queryFn: async () => {
      const boxNames = await algorand.client.algod.getApplicationBoxes(appId).do()
      return await Promise.all(
        boxNames.boxes.map(async (box) => {
          const boxContent = await algorand.client.algod.getApplicationBoxByName(appId, box.name).do()
          return {
            seller: encodeAddress(box.name.slice(0, 32)),
            assetId: decodeUint64(box.name.slice(32, 40), 'bigint'),
            nonce: decodeUint64(box.name.slice(40, 48), 'bigint'),
            amount: decodeUint64(boxContent.value.slice(0, 8), 'bigint'),
            unitaryPrice: decodeUint64(boxContent.value.slice(8, 16), 'bigint'),
          }
        }),
      )
    },
    staleTime: 1_000,
  })
  const [sellerAddress, setSellerAddress] = useState<string>('')
  const [buyingAssetId, setBuyingAssetId] = useState<bigint>(0n)
  // const bestBidQuery = useQuery({
  //   queryKey: ['bid', appId, sellerAddress, Number(buyingAssetId)],
  //   queryFn: async () => {
  //     const boxContent = await algorand.client.algod
  //       .getApplicationBoxByName(
  //         appId,
  //         new Uint8Array([...decodeAddress(sellerAddress).publicKey, ...encodeUint64(buyingAssetId), ...encodeUint64(0)]),
  //       )
  //       .do()
  //     return {
  //       bidder: encodeAddress(boxContent.value.slice(16, 48)),
  //       bidQuantity: decodeUint64(boxContent.value.slice(48, 56), 'bigint'),
  //       bidUnitaryPrice: decodeUint64(boxContent.value.slice(56, 64), 'bigint'),
  //     }
  //   },
  //   staleTime: 1_000,
  // })
  const [buyingQuantity, setBuyingQuantity] = useState<bigint>(0n)
  const [buyingPrice, setBuyingPrice] = useState<bigint>(0n)
  const { activeAddress, signer } = useWallet()

  const algodConfig = getAlgodConfigFromViteEnvironment()
  const algorand = AlgorandClient.fromConfig({ algodConfig })
  algorand.setDefaultSigner(signer)

  const dmClient = new AgroshopClient(
    {
      resolveBy: 'id',
      id: appId,
      sender: { addr: activeAddress!, signer },
    },
    algorand.client.algod,
  )

  const toggleWalletModal = () => {
    setOpenWalletModal(!openWalletModal)
  }

  return (
    <div className="hero min-h-screen bg-green-900">
      <div className="hero-content text-center rounded-lg p-6 max-w-md bg-emerald-200 mx-auto">
        <div className="max-w-md">
          <h1 className="text-4xl">
            Welcome to <span className="font-bold">Agroshop</span>
          </h1>
          <p className="py-6">
            Your decentralized suply chain
          </p>

          <div className="grid">
            <button data-test-id="connect-wallet" className="btn  bg-black text-white rounded-md m-2" onClick={toggleWalletModal}>
              Wallet Connection
            </button>

            <div className="divider" />

            {activeAddress && appId === 0 && (
              <div>
                <MethodCall methodFunction={methods.create(algorand, dmClient, activeAddress, setAppId)} text="Create Marketplace" />
              </div>
            )}

            <div className="divider" />

            {appId !== 0 && activeAddress && (
              <div>
                <label className="label">Amount To Sell</label>
                <input
                  type="number"
                  className="input input-bordered m-2"
                  value={amountToSell.toString()}
                  onChange={(e) => setAmountToSell(BigInt(e.currentTarget.valueAsNumber || 0n))}
                />
                <label className="label">Selling Price</label>
                <input
                  type="number"
                  className="input input-bordered m-2"
                  value={sellingPrice.toString()}
                  onChange={(e) => setSellingPrice(BigInt(e.currentTarget.valueAsNumber || 0n))}
                />
                <MethodCall
                  methodFunction={methods.sell(algorand, dmClient, activeAddress, amountToSell, sellingPrice)}
                  text="Sell Asset"
                />
              </div>
            )}

            <div className="divider" />

            <label className="label">Products</label>
            {appId !== 0 && !listingsQuery.isError && (
              <ul>
                {listingsQuery.data?.map((listing) => (
                  <li
                    key={listing.seller + listing.assetId.toString() + listing.nonce.toString()}
                  >{`assetId: ${listing.assetId}\namount: ${listing.amount}\nprice: ${listing.unitaryPrice}`}</li>
                ))}
              </ul>
            )}

            <div className="divider" />

            {activeAddress && appId !== 0 && (
              <div>
                <label className="label">Seller Address</label>
                <input
                  type="text"
                  className="input input-bordered m-2"
                  value={sellerAddress}
                  onChange={(e) => setSellerAddress(e.currentTarget.value)}
                />
                <label className="label">Asset To Buy</label>
                <input
                  type="number"
                  className="input input-bordered m-2"
                  value={buyingAssetId.toString()}
                  onChange={(e) => setBuyingAssetId(BigInt(e.currentTarget.valueAsNumber || 0n))}
                />
                <label className="label">Amount</label>
                <input
                  type="number"
                  className="input input-bordered m-2"
                  value={buyingQuantity.toString()}
                  onChange={(e) => setBuyingQuantity(BigInt(e.currentTarget.valueAsNumber || 0n))}
                />
                <label className="label">Price</label>
                <input
                  type="number"
                  className="input input-bordered m-2"
                  value={buyingPrice.toString()}
                  onChange={(e) => setBuyingPrice(BigInt(e.currentTarget.valueAsNumber || 0n))}
                />
                <MethodCall
                  methodFunction={methods.buy(algorand, dmClient, sellerAddress, buyingAssetId, activeAddress, buyingQuantity, buyingPrice)}
                  text={`Buy ${buyingQuantity} unit for ${Number(buyingPrice * buyingQuantity)} ALGO`}
                />

              </div>
            )}

            <div className="divider" />
            <label className="label">Track Asset</label>

            {/*{activeAddress !== sellerAddress && appId !== 0 && unitsLeft === 0n && (*/}
            {/*  <button className="btn btn-disabled m-2" disabled={true}>*/}
            {/*    SOLD OUT!*/}
            {/*  </button>*/}
            {/*)}*/}

            {/*{activeAddress === sellerAddress && appId !== 0 && unitsLeft === 0n && (*/}
            {/*  <MethodCall methodFunction={methods.deleteApp(dmClient, setAppId)} text="Delete App" />*/}
            {/*)}*/}
          </div>

          <ConnectWallet openModal={openWalletModal} closeModal={toggleWalletModal} />
        </div>
      </div>
    </div>
  )
}

export default Home
