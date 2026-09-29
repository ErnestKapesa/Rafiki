import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { DEFAULT_CHARACTER, type Character } from "../../shared/game";
import { sfx, unlockAudio } from "../audio/sfx";
import { useGame } from "../game/store";
import { useRafiki } from "../lib/store";
import { speak } from "../voice/voice";
import { Customizer, type Tab } from "./Customizer";
import { Icon } from "./Icon";

/** Tolan-style first run: a star in the dark hatches into your new friend. */
export function Onboarding() {
  const step = useRafiki((s) => s.onboardStep);
  const set = useRafiki((s) => s.set);
  const [you, setYou] = useState("");
  const [friend, setFriend] = useState("Rafiki");
  const [look, setLook] = useState<Character>({ ...DEFAULT_CHARACTER });
  const [tab, setTab] = useState<Tab>("look");

  const hatch = () => {
    unlockAudio();
    sfx.hatch();
    set({ hatched: true });
    setTimeout(() => {
      set({ onboardStep: "name", pose: "celebrate" });
      setTimeout(() => speak("Jambo! Hi! I'm so happy to meet you."), 400);
      setTimeout(() => useRafiki.getState().set({ pose: "idle" }), 1400);
    }, 1500);
  };

  const change = (c: Character) => {
    setLook(c);
    useGame.getState().setPreview(c);
  };

  const finish = () => {
    sfx.chime();
    useGame.getState().finishOnboarding(you.trim() || "Explorer", friend.trim() || "Rafiki", look);
    set({ onboardStep: null, pose: "celebrate" });
    setTimeout(() => speak(`Yay! Let's explore the web together, ${you.trim() || "friend"}! Ask me anything.`), 300);
    setTimeout(() => useRafiki.getState().set({ pose: "idle" }), 1500);
  };

  return (
    <div className={`onboarding step-${step}`}>
      <AnimatePresence mode="wait">
        {step === "orb" && (
          <motion.div key="orb" className="ob-orb" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.05 }}>
            <motion.h1 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
              rafiki
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
              Something is stirring among the stars…
            </motion.p>
            <button className="orb-hit" onClick={hatch} aria-label="Hatch your friend" />
            <motion.button className="pill-btn glow" onClick={hatch} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.6 }} whileTap={{ scale: 0.95 }}>
              <Icon name="egg" size={24} /> Tap to hatch
            </motion.button>
          </motion.div>
        )}

        {step === "name" && (
          <motion.form
            key="name"
            className="ob-card"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (!you.trim()) return;
              sfx.pop();
              set({ onboardStep: "friend" });
              useGame.getState().setPreview(look);
              speak(`Nice to meet you, ${you.trim()}! Now make me look awesome.`);
            }}
          >
            <div className="ob-bubble">Jambo! I just hatched. What's your name?</div>
            <div className="ob-input">
              <input autoFocus value={you} onChange={(e) => setYou(e.target.value)} placeholder="Your name" maxLength={32} aria-label="Your name" />
              <motion.button type="submit" className="round-go" disabled={!you.trim()} whileTap={{ scale: 0.9 }} aria-label="Next">
                →
              </motion.button>
            </div>
          </motion.form>
        )}

        {step === "friend" && (
          <motion.div key="friend" className="ob-customize sheet-card" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
            <h2>
              <Icon name="palette" size={30} float /> Make me yours
            </h2>
            <label className="field">
              <span>My name</span>
              <input value={friend} onChange={(e) => setFriend(e.target.value)} maxLength={24} />
            </label>
            <div className="tabs">
              {(["look", "neck"] as const).map((t) => (
                <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
                  {t === "look" ? "Look" : "Scarf"}
                </button>
              ))}
            </div>
            <Customizer value={look} onChange={change} tab={tab} freeOnly />
            <motion.button className="pill-btn primary big" onClick={finish} whileTap={{ scale: 0.96 }} whileHover={{ y: -2 }}>
              <Icon name="rocket" size={26} /> Let's explore!
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
