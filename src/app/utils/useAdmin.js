import { useCallback, useEffect } from 'react'
import { SendMessageRequest } from 'amazon-ivs-chat-messaging'
import { useSelector } from 'react-redux'
import {
  useChatTokenSetup,
  SEND_BID,
  START_AUCTION_EVENT,
  END_AUCTION_EVENT,
} from './useChatTokenSetup'
import useActions from '../state/useActions'
import constants from '../constants'
const { STARTED } = constants.AUCTION_STATUS

const useAdmin = () => {
  const { username } = useSelector(state => state.auction)
  const { room } = useChatTokenSetup(username)
  const { bidAuction } = useActions()
  const { product, maxBid, status } = useSelector(state => state.auction)


  useEffect(() => {
    if (!room || !product || product.productName === null) {
      return
    }

    const unsubscribeOnMessage = room.addListener('message', (message) => {
      if (message.attributes.eventType === SEND_BID) {
        //Ignore bids that come in with less that 5 seconds remaining.
        const remainingTimeMilliSecondsInAuction = (product.auctionStartTimeMilliSeconds + (product.durationSeconds * 1000)) - Date.now() - 5000
        if (status !== STARTED || remainingTimeMilliSecondsInAuction < 0) {
          return
        }
        bidAuction({
          bidValue: message.attributes.bidValue,
          bidSender: message.sender.userId,
          bidResult: null,
        })
      }
    })
    return () => {
      unsubscribeOnMessage()
    }
  }, [room, product])

  useEffect(() => {
    const sendHeartBeat = () => {
      //Dont send out a heart beat if less than 20 seconds remaining.
      const remainingTimeMilliSecondsInAuction = (product.auctionStartTimeMilliSeconds + (product.durationSeconds * 1000)) - Date.now() - 20000
      if (status === STARTED && remainingTimeMilliSecondsInAuction > 0) {
        sendStartAuction(room, product, maxBid)
      }
    }
    const heartBeatIntervalId = setInterval(() => { sendHeartBeat() }, 10000)

    return () => {
      clearInterval(heartBeatIntervalId)
    }
  }, [room, product, maxBid, status])

  const sendStartAuction = (room, product) => {
    if (!room || !product || product.productName === null) {
      return
    }
    console.log('message from sendstartAuction');
    const request = new SendMessageRequest('skip', {
      eventType: START_AUCTION_EVENT,
      product: JSON.stringify(product),
    })
    room.sendMessage(request)
  }

  const startAuction = useCallback(() => {
    sendStartAuction(room, product)
  }, [room, product])

  const endAuction = async (type, maxBidder) => {
    if (!room || !product || product.productName === null) {
      return
    }
    const request = new SendMessageRequest('skip', {
      eventType: END_AUCTION_EVENT,
      bidResult: type, //either CANCELLED, NO_BID or SOLD
      maxBidder: maxBidder
    })
    try {
      await room.sendMessage(request)
    } catch (error) {
      console.log('Cannot end auction: ', error)
    }
  }

  return { startAuction, endAuction }
}

export default useAdmin
