import React from "react";
import { Mail, MapPin, Phone, ArrowRight, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { WordPullUp } from "../../components/public/WordPullUp";

const contactChannels: Array<{
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  value: string;
  href?: string;
  directions?: string;
}> = [
  {
    icon: Mail,
    eyebrow: "Email",
    title: "Email us",
    value: "info@cedarguard.co.uk",
    href: "mailto:info@cedarguard.co.uk",
  },
  {
    icon: Phone,
    eyebrow: "Phone",
    title: "Call us",
    value: "+44 (0) 2031433504",
    href: "tel:+442031433504",
  },
  {
    icon: MapPin,
    eyebrow: "Office",
    title: "Visit us",
    value: "Cedar Guard Ltd\n10 The New Inn Court\n54 Matham Road\nEast Molesey, KT8 0BE",
    directions: "https://maps.app.goo.gl/R64bu5P5Srdh66we9",
  },
];

const CARD_CLASS =
  'group relative flex items-start gap-4 overflow-hidden rounded-xl border border-[oklch(0.91_0.006_270)] bg-white p-7 transition-[transform,border-color,box-shadow,background] duration-[320ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] hover:-translate-y-1 hover:scale-[1.01] hover:border-[oklch(0.62_0.24_278_/_0.45)] hover:shadow-[0_0_0_1px_oklch(0.62_0.24_278_/_0.20),0_20px_40px_-16px_oklch(0.62_0.24_278_/_0.30),0_0_60px_-10px_oklch(0.62_0.24_278_/_0.22)] before:pointer-events-none before:absolute before:inset-0 before:z-0 before:bg-[radial-gradient(60%_80%_at_50%_0%,oklch(0.62_0.24_278_/_0.14),transparent_70%)] before:opacity-0 before:transition-opacity before:duration-[320ms] before:content-[""] hover:before:opacity-100 dark:border-white/10 dark:bg-white/3';

const INPUT_CLASS =
  "h-12 w-full rounded-lg border border-[oklch(0.91_0.006_270)] bg-white px-4 text-[15px] text-[oklch(0.20_0.012_270)] outline-none transition-[border-color,box-shadow] duration-[140ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] placeholder:text-[oklch(0.68_0.010_270)] focus:border-[var(--accent)] focus:shadow-[0_0_0_4px_oklch(0.62_0.24_278_/_0.10)] dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500";

const LABEL_CLASS =
  "mb-2 block font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[oklch(0.50_0.010_270)] dark:text-slate-400";

const EASE: [number, number, number, number] = [0.22, 0.61, 0.36, 1];

const HEADLINE_WORDS: Array<{ word: string; gradient?: boolean }> = [
  { word: "Get" },
  { word: "in" },
  { word: "touch" },
  { word: "with", gradient: true },
  { word: "our", gradient: true },
  { word: "team.", gradient: true },
];

const DESCRIPTION_DELAY_S =
  0.35 + HEADLINE_WORDS.length * 0.12 + 0.4;
const CARDS_START_DELAY_S = DESCRIPTION_DELAY_S + 0.6;
const CARD_STAGGER_S = 0.22;
const CARD_SLIDE_DURATION_S = 0.85;

export const Contact: React.FC = () => {
  return (
    <div
      className="relative overflow-hidden bg-white font-sans dark:bg-[#030303]"
      style={
        {
          "--accent": "oklch(0.62 0.24 278)",
          "--accent-hot": "oklch(0.70 0.26 280)",
        } as React.CSSProperties
      }
    >
      {/* Hero backdrop — masked accent grid (exact tokens) + radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-130"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.62 0.24 278 / 0.06) 1px, transparent 1px), linear-gradient(90deg, oklch(0.62 0.24 278 / 0.06) 1px, transparent 1px)",
          backgroundSize: "38px 38px",
          WebkitMaskImage:
            "radial-gradient(70% 60% at 50% 18%, #000 35%, transparent 85%)",
          maskImage:
            "radial-gradient(70% 60% at 50% 18%, #000 35%, transparent 85%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-80px] h-[540px] w-[1200px] max-w-none -translate-x-1/2"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 30%, oklch(0.62 0.24 278 / 0.18), transparent 65%), radial-gradient(45% 40% at 30% 25%, oklch(0.68 0.24 248 / 0.12), transparent 70%)",
          filter: "blur(2px)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-7xl px-6 pt-20 pb-28 sm:pt-24">
        {/* Hero header */}
        <div className="mx-auto max-w-4xl text-center">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="inline-flex items-center gap-2 rounded-full border border-[oklch(0.91_0.006_270)] bg-white px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-[oklch(0.32_0.012_270)] shadow-[0_2px_8px_-4px_oklch(0_0_0_/_0.06)] dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            </span>
            We're here to help
          </motion.span>

          <WordPullUp
            words={HEADLINE_WORDS}
            className="mt-[22px] text-[clamp(30px,5.4vw,60px)] font-medium leading-[1.02] tracking-[-0.035em] text-[oklch(0.20_0.012_270)] md:whitespace-nowrap dark:text-white"
          />

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: DESCRIPTION_DELAY_S, ease: EASE }}
            className="mx-auto mt-4 max-w-[600px] text-[16px] leading-[1.6] text-[oklch(0.50_0.010_270)] dark:text-slate-400"
          >
            Interested in deploying our platform for your social housing
            portfolio? Our team is ready to provide a tailored demonstration.
          </motion.p>
        </div>

        {/* Channels + form */}
        <div className="mt-16 grid gap-6 lg:grid-cols-2 lg:gap-8">
          {/* Contact channels */}
          <div className="flex flex-col gap-4">
            {contactChannels.map(
              ({ icon: Icon, eyebrow, title, value, href, directions }, index) => {
                const body = (
                  <>
                    <span className="relative z-[1] grid h-11 w-11 shrink-0 place-items-center rounded-[10px] border border-[oklch(0.62_0.24_278_/_0.22)] bg-[oklch(0.62_0.24_278_/_0.10)] text-[var(--accent)] transition-[transform,background] duration-[320ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] group-hover:scale-[1.06] group-hover:-rotate-3 group-hover:bg-[oklch(0.62_0.24_278_/_0.18)] dark:text-indigo-300">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="relative z-[1] min-w-0">
                      <div className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[oklch(0.50_0.010_270)] dark:text-slate-500">
                        {eyebrow}
                      </div>
                      <div className="mt-0.5 text-[19px] font-semibold tracking-[-0.02em] text-[oklch(0.20_0.012_270)] dark:text-white">
                        {title}
                      </div>
                      <div className="mt-1 whitespace-pre-line text-[13.5px] leading-relaxed text-[oklch(0.50_0.010_270)] dark:text-slate-400">
                        {value}
                      </div>
                      {directions && (
                        <a
                          href={directions}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-[var(--accent)] transition-[gap] duration-[140ms] hover:gap-2.5"
                        >
                          Get directions
                          <ArrowRight className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </>
                );

                const itemMotionProps = {
                  initial: { opacity: 0, x: -48 },
                  animate: { opacity: 1, x: 0 },
                  transition: {
                    duration: CARD_SLIDE_DURATION_S,
                    delay: CARDS_START_DELAY_S + index * CARD_STAGGER_S,
                    ease: EASE,
                  },
                };

                return href ? (
                  <motion.a
                    key={title}
                    href={href}
                    className={CARD_CLASS}
                    {...itemMotionProps}
                  >
                    {body}
                  </motion.a>
                ) : (
                  <motion.div
                    key={title}
                    className={CARD_CLASS}
                    {...itemMotionProps}
                  >
                    {body}
                  </motion.div>
                );
              },
            )}
          </div>

          {/* Message form */}
          <motion.div
            initial={{ opacity: 0, x: 48 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: CARD_SLIDE_DURATION_S,
              delay: CARDS_START_DELAY_S + contactChannels.length * CARD_STAGGER_S,
              ease: EASE,
            }}
            className="rounded-xl border border-[oklch(0.91_0.006_270)] bg-white p-6 shadow-[0_8px_28px_-18px_oklch(0_0_0_/_0.14)] dark:border-white/10 dark:bg-white/3 sm:p-8"
          >
            <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[oklch(0.20_0.012_270)] dark:text-white">
              Send a message
            </h2>
            <p className="mt-1.5 text-[13.5px] text-[oklch(0.50_0.010_270)] dark:text-slate-400">
              Tell us a little about your portfolio and we'll be in touch.
            </p>

            <form
              className="mt-7 space-y-5"
              onSubmit={(e) => e.preventDefault()}
            >
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="firstName" className={LABEL_CLASS}>
                    First name
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    placeholder="John"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className={LABEL_CLASS}>
                    Last name
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    placeholder="Doe"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className={LABEL_CLASS}>
                  Work email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="john@council.gov.uk"
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label htmlFor="message" className={LABEL_CLASS}>
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={5}
                  placeholder="How can we help you..."
                  className="w-full resize-none rounded-lg border border-[oklch(0.91_0.006_270)] bg-white px-4 py-3 text-[15px] text-[oklch(0.20_0.012_270)] outline-none transition-[border-color,box-shadow] duration-[140ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] placeholder:text-[oklch(0.68_0.010_270)] focus:border-[var(--accent)] focus:shadow-[0_0_0_4px_oklch(0.62_0.24_278_/_0.10)] dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500"
                />
              </div>

              <button
                type="submit"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-[oklch(0.54_0.24_278)] bg-[var(--accent)] text-[13.5px] font-semibold text-white shadow-[0_8px_22px_-8px_oklch(0.62_0.24_278_/_0.22)] transition-[background] duration-[140ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] hover:bg-[var(--accent-hot)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.62_0.24_278_/_0.55)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#030303]"
              >
                Submit request
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
