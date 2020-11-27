import crypto from 'crypto';
import fetch from 'node-fetch';
import { machineIdSync } from 'node-machine-id';

export type BaseEvent = {
  name: string,
  [key: string]: any,
};

export type Event = BaseEvent & {
  id: string,
  clientTimestamp: string,
  anonymousId: string,
  platform: string,
  nodeVersion: string,
};

let flushPromise: Promise<any>|null = null;
let trackEvents: Array<Event> = [];

async function flush(toFlush?: Array<Event>, retries: number = 10): Promise<any> {
  if (!toFlush) {
    toFlush = trackEvents;
    trackEvents = [];
  }

  if (!toFlush.length) {
    return;
  }

  try {
    const sentAt = new Date().toJSON();
    const result = await fetch('https://track.cube.dev/track', {
      method: 'post',
      body: JSON.stringify(toFlush.map(r => ({ ...r, sentAt }))),
      headers: { 'Content-Type': 'application/json' },
    });

    if (result.status !== 200 && retries > 0) {
      // eslint-disable-next-line consistent-return
      return flush(toFlush, retries - 1);
    }

    // console.log(await result.json());
  } catch (e) {
    if (retries > 0) {
      // eslint-disable-next-line consistent-return
      return flush(toFlush, retries - 1);
    }
    // console.log(e);
  }
}

let anonymousId: string = 'unknown';

try {
  anonymousId = machineIdSync();
} catch (e) {
  // console.error(e);
}

export async function track(opts: BaseEvent) {
  trackEvents.push({
    ...opts,
    id: crypto.randomBytes(16).toString('hex'),
    clientTimestamp: new Date().toJSON(),
    platform: process.platform,
    nodeVersion: process.version,
    anonymousId,
  });

  const currentPromise = (flushPromise || Promise.resolve()).then(() => flush()).then(() => {
    if (currentPromise === flushPromise) {
      flushPromise = null;
    }
  });

  flushPromise = currentPromise;
  return flushPromise;
}

export async function event(opts: BaseEvent) {
  try {
    await track(opts);
  } catch (e) {
    // console.error(e);
  }
}
