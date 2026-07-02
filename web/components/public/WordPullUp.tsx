import React from 'react';
import { motion, type Variants } from 'motion/react';

const EASE: [number, number, number, number] = [0.22, 0.61, 0.36, 1];

interface WordPullUpProps {
    words: Array<{ word: string; gradient?: boolean; breakAfter?: boolean }>;
    className?: string;
    delayChildren?: number;
    staggerChildren?: number;
}

const GRADIENT_CLASS =
    'not-italic bg-[linear-gradient(135deg,oklch(0.62_0.24_278),oklch(0.50_0.28_254))] bg-clip-text text-transparent';

export function WordPullUp({
    words,
    className,
    delayChildren = 0.35,
    staggerChildren = 0.12,
}: WordPullUpProps) {
    const wrapperVariants: Variants = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren, delayChildren } },
    };
    const wordVariants: Variants = {
        hidden: { y: 24, opacity: 0 },
        show: { y: 0, opacity: 1, transition: { duration: 0.6, ease: EASE } },
    };

    return (
        <motion.h1
            variants={wrapperVariants}
            initial="hidden"
            animate="show"
            className={className}
        >
            {words.map(({ word, gradient, breakAfter }, index) => (
                <React.Fragment key={index}>
                    <motion.span
                        variants={wordVariants}
                        style={{ display: 'inline-block', paddingRight: '0.28em' }}
                        className={gradient ? GRADIENT_CLASS : undefined}
                    >
                        {word}
                    </motion.span>
                    {breakAfter && <br />}
                </React.Fragment>
            ))}
        </motion.h1>
    );
}
