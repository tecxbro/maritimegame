import {harness} from './review.mjs';
const {q}=harness();await Promise.resolve();q.start();q.frame(20);q.pause();q.frame(40);const before=q.state.renderer.drawCount;q.resize();q.frame(60);console.log('SAME-SIZE UI SKIP (canvas preservation verified in renderer suite)',JSON.stringify({before,after:q.state.renderer.drawCount,repainted:q.state.renderer.drawCount>before}));
