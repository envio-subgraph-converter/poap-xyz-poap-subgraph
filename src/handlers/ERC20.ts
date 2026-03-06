import { Poap } from "generated";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

Poap.EventToken.handler(async ({ event, context }) => {
  const eventId = event.params.eventId.toString();
  const tokenId = event.params.tokenId.toString();

  let poapEvent = await context.Event.get(eventId);
  const token = await context.Token.get(tokenId);

  if (poapEvent === undefined) {
    poapEvent = {
      id: eventId,
      tokenCount: 0n,
      tokenMints: 0n,
      transferCount: 0n,
      created: BigInt(event.block.timestamp),
    };
  }

  const updatedEvent = {
    ...poapEvent,
    tokenCount: poapEvent.tokenCount + 1n,
    tokenMints: poapEvent.tokenMints + 1n,
    transferCount: poapEvent.transferCount + 1n,
  };

  context.Event.set(updatedEvent);

  if (token !== undefined) {
    context.Token.set({
      ...token,
      event_id: eventId,
      mintOrder: updatedEvent.tokenMints,
    });
  }
});

Poap.Transfer.handler(async ({ event, context }) => {
  const fromAddress = event.params.from;
  const toAddress = event.params.to;
  const tokenId = event.params.tokenId.toString();
  const transferId = `${event.block.number}-${event.logIndex}`;

  // Handle from account
  let from = await context.Account.get(fromAddress);
  if (from === undefined) {
    from = {
      id: fromAddress,
      tokensOwned: 1n,
    };
  }
  // Don't subtract from ZERO_ADDRESS (it's the one that mints tokens)
  if (fromAddress !== ZERO_ADDRESS) {
    from = { ...from, tokensOwned: from.tokensOwned - 1n };
  }
  context.Account.set(from);

  // Handle to account
  let to = await context.Account.get(toAddress);
  if (to === undefined) {
    to = {
      id: toAddress,
      tokensOwned: 0n,
    };
  }
  to = { ...to, tokensOwned: to.tokensOwned + 1n };
  context.Account.set(to);

  // Handle token
  let token = await context.Token.get(tokenId);
  if (token === undefined) {
    token = {
      id: tokenId,
      owner_id: toAddress,
      transferCount: 0n,
      created: BigInt(event.block.timestamp),
    };
  }
  token = {
    ...token,
    owner_id: toAddress,
    transferCount: token.transferCount + 1n,
  };
  context.Token.set(token);

  // Update event if token is associated with one
  if (token.event_id !== undefined) {
    const poapEvent = await context.Event.get(token.event_id);
    if (poapEvent !== undefined) {
      let updatedEvent = {
        ...poapEvent,
        transferCount: poapEvent.transferCount + 1n,
      };
      // Burning the token (transfer to zero address)
      if (toAddress === ZERO_ADDRESS) {
        updatedEvent = {
          ...updatedEvent,
          tokenCount: updatedEvent.tokenCount - 1n,
          // Subtract all the transfers from the burned token
          transferCount: updatedEvent.transferCount - token.transferCount,
        };
      }
      context.Event.set(updatedEvent);
    }
  }

  context.Transfer.set({
    id: transferId,
    token_id: tokenId,
    from_id: fromAddress,
    to_id: toAddress,
    transaction: event.transaction.hash ?? "",
    timestamp: BigInt(event.block.timestamp),
  });
});
