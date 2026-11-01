import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SleepTimerController } from '../dist/index.js';

test('SleepTimerController - sets preset timer and updates remaining countdown', () => {
  const timer = new SleepTimerController();
  assert.equal(timer.isActive(), false);
  assert.equal(timer.isEndOfTrack(), false);

  timer.setTimer(15);
  assert.equal(timer.isActive(), true);
  assert.equal(timer.getOption(), 15);
  assert.equal(timer.getRemainingSeconds(), 900);
  assert.equal(timer.getState().formattedRemaining, '15:00');

  timer.cancelTimer();
  assert.equal(timer.isActive(), false);
  assert.equal(timer.getOption(), 0);
  assert.equal(timer.getRemainingSeconds(), 0);
  timer.destroy();
});

test('SleepTimerController - endOfTrack mode flags isEndOfTrack without countdown', () => {
  const timer = new SleepTimerController();
  timer.setTimer('endOfTrack');

  assert.equal(timer.isActive(), true);
  assert.equal(timer.isEndOfTrack(), true);
  assert.equal(timer.getRemainingSeconds(), 0);
  assert.equal(timer.getState().formattedRemaining, '');

  timer.cancelTimer();
  assert.equal(timer.isActive(), false);
  assert.equal(timer.isEndOfTrack(), false);
  timer.destroy();
});

test('SleepTimerController - checkTick passive clock calibration triggers when time reached', () => {
  let triggered = false;
  const timer = new SleepTimerController(() => {
    triggered = true;
  });

  // Set 1 minute
  timer.setTimer(1);
  assert.equal(timer.checkTick(), false);
  assert.equal(triggered, false);

  // Artificially fast-forward targetTimestamp to simulate wall-clock passage during background sleep
  const state = timer.getState();
  timer.targetTimestamp = Date.now() - 1000;

  const didTrigger = timer.checkTick();
  assert.equal(didTrigger, true);
  assert.equal(triggered, true);
  assert.equal(timer.isActive(), false);
  timer.destroy();
});
