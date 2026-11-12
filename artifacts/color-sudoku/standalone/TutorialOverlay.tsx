import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CircleHelp, Hand, Lightbulb, Pause } from 'lucide-react';

const lessons = [
  { icon: CircleHelp, title: 'One of each color', body: 'Fill every space so each color appears once in every row, column, and box. There are no numbers.' },
  { icon: Hand, title: 'Choose, then place', body: 'Tap a color, then an empty square. You can also drag the color right onto a square. Matching colors light up to help you scan.' },
  { icon: Lightbulb, title: 'Try color notes', body: 'Turn on Notes when you are unsure. Add small color dots as possibilities; choose a color again to remove its note.' },
  { icon: Pause, title: 'Play at your pace', body: 'Undo a move or pause whenever you like. Your puzzle is saved in this browser, and you can resume from Home.' },
];

export function TutorialOverlay({ onClose }: { onClose(): void }) {
  const [step, setStep] = useState(0);
  const lesson = lessons[step];
  const Icon = lesson.icon;
  const finish = () => { setStep(0); onClose(); };

  return (
    <div className="tutorial-backdrop" data-testid="tutorial-overlay">
      <section className="tutorial-card" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
        <div className="tutorial-icon"><Icon size={25} aria-hidden="true" /></div>
        <p className="tutorial-kicker">HOW TO PLAY · {step + 1} OF {lessons.length}</p>
        <h2 id="tutorial-title">{lesson.title}</h2>
        <p className="tutorial-copy">{lesson.body}</p>
        <div className="tutorial-dots" aria-label={`Lesson ${step + 1} of ${lessons.length}`}>
          {lessons.map((item, i) => <span key={item.title} className={i === step ? 'is-current' : ''} />)}
        </div>
        <div className="tutorial-actions">
          <button type="button" className="tutorial-secondary" onClick={finish} data-testid="button-tutorial-skip">Skip</button>
          {step > 0 && <button type="button" className="tutorial-secondary" onClick={() => setStep(i => i - 1)} data-testid="button-tutorial-back"><ArrowLeft size={15} /> Back</button>}
          <button type="button" className="primary-button" onClick={step === lessons.length - 1 ? finish : () => setStep(i => i + 1)}
            data-testid={step === lessons.length - 1 ? 'button-tutorial-done' : 'button-tutorial-next'}>
            {step === lessons.length - 1 ? 'Let’s play' : 'Next'}
            {step === lessons.length - 1 ? <Check size={15} /> : <ArrowRight size={15} />}
          </button>
        </div>
      </section>
    </div>
  );
}
