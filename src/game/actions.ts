import type { Source } from "../../shared/types";
import { useRafiki, type Answer } from "../lib/store";
import { useGame } from "./store";
import { sfx } from "../audio/sfx";

/** Glue between the search experience and the game engine. */

export function rewardExploration(a: Answer) {
  if (a.rewarded || a.error || !a.markdown) return;
  const journal = useRafiki.getState().journal;
  // A trail only counts if the parent was itself rewarded (exists in the engine).
  const parent = a.parentId && journal.some((j) => j.id === a.parentId && j.rewarded) ? a.parentId : null;
  const r = useGame.getState().exploration({
    id: a.id,
    question: a.question,
    mode: a.mode,
    topic: a.topic,
    emoji: a.emoji,
    sourceCount: a.sources.length,
    viaVoice: a.viaVoice,
    parentId: parent,
    localHour: new Date().getHours(),
  });
  useRafiki.getState().patchCurrent({ rewarded: !!r });
  // Worlds visited while the answer was still streaming get paid out now.
  if (r) for (const url of a.discovered) useGame.getState().discover(url, a.id);
}

/** Open a source in the in-app Reader and count it as a discovered world. */
export function visitSource(a: Answer, s: Source, openReader = true) {
  if (!/^https?:\/\//i.test(s.url)) return; // never open javascript:/data: links from the web
  if (openReader) {
    sfx.open();
    useRafiki.getState().set({ reader: { url: s.url, title: s.title, domain: s.domain, favicon: s.favicon, answerId: a.id } });
  }
  const cur = useRafiki.getState().current;
  const live = cur?.id === a.id ? cur : a; // props can be a render behind on fast clicks
  if (live.discovered.includes(s.url)) return;
  if (cur?.id === a.id) useRafiki.getState().patchCurrent({ discovered: [...live.discovered, s.url] });
  if (live.rewarded) useGame.getState().discover(s.url, a.id);
  else sfx.discover();
}

export function answerQuiz(a: Answer, pick: number) {
  if (!a.quiz || a.quizPick !== null) return;
  const correct = pick === a.quiz.answer;
  useRafiki.getState().patchCurrent({ quizPick: pick });
  (correct ? sfx.correct : sfx.wrong)();
  if (correct) useRafiki.getState().set({ pose: "happy" });
  if (a.rewarded) useGame.getState().quiz(a.id, correct);
}
