import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { newsArticles } from '../../data/newsData';

const SITE = 'https://cedarguard.co.uk';

type Meta = { title: string; description: string };

const DEFAULT_DESCRIPTION =
    'The agentic operating system for UK social housing governance—coordinating risk, compliance, assurance and evidence across housing delivery.';

const ROUTE_META: Record<string, Meta> = {
    '/': {
        title: 'CedarGuard | Agentic Governance, Risk & Compliance',
        description: DEFAULT_DESCRIPTION,
    },
    '/product': {
        title: 'Product | CedarGuard Governance, Risk & Compliance',
        description:
            'Explore CedarGuard: agentic governance and programme assurance, continuous risk intelligence, compliance orchestration, technical assurance, evidence capture and audit-ready reporting for UK social housing delivery.',
    },
    '/about': {
        title: 'About | CedarGuard',
        description:
            'CedarGuard is the agentic governance, risk and compliance operating system for UK social housing delivery — built from practical governance and risk frameworks created within local government.',
    },
    '/news': {
        title: 'Insights & News | CedarGuard',
        description:
            'Latest insights on UK social housing compliance, the Building Safety Act, RSH consumer standards and property risk management from the CedarGuard team.',
    },
    '/support': {
        title: 'Support | CedarGuard',
        description:
            'Help, FAQs and support for CedarGuard — the agentic governance, risk and compliance platform for UK social housing delivery.',
    },
    '/contact': {
        title: 'Contact | CedarGuard',
        description:
            'Get in touch with CedarGuard to see how agentic governance, risk and compliance can support your council, housing association or ALMO.',
    },
    '/api-docs': {
        title: 'API Documentation | CedarGuard',
        description:
            'Developer documentation for the CedarGuard API — integrate compliance, risk and governance data into your own systems.',
    },
    '/help': {
        title: 'Help Centre | CedarGuard',
        description:
            'Guides and answers for getting the most out of CedarGuard compliance and risk management.',
    },
};

function upsertTag(selector: string, create: () => HTMLElement, attr: string, value: string) {
    let el = document.head.querySelector(selector) as HTMLElement | null;
    if (!el) {
        el = create();
        document.head.appendChild(el);
    }
    el.setAttribute(attr, value);
}

function setMeta(property: 'name' | 'property', key: string, content: string) {
    upsertTag(
        `meta[${property}="${key}"]`,
        () => {
            const m = document.createElement('meta');
            m.setAttribute(property, key);
            return m;
        },
        'content',
        content,
    );
}

export default function RouteSeo() {
    const { pathname } = useLocation();

    useEffect(() => {
        // News articles self-canonicalise to their own URL and use the article's own title/excerpt.
        let meta = ROUTE_META[pathname];
        if (!meta && pathname.startsWith('/news/')) {
            const article = newsArticles.find((a) => a.id === pathname.slice('/news/'.length));
            meta = article
                ? { title: `${article.title} | CedarGuard`, description: article.description }
                : ROUTE_META['/news'];
        }
        meta ??= ROUTE_META['/'];
        const url = SITE + (pathname === '/' ? '/' : pathname);

        document.title = meta.title;
        setMeta('name', 'description', meta.description);
        upsertTag('link[rel="canonical"]', () => {
            const l = document.createElement('link');
            l.setAttribute('rel', 'canonical');
            return l;
        }, 'href', url);

        setMeta('property', 'og:title', meta.title);
        setMeta('property', 'og:description', meta.description);
        setMeta('property', 'og:url', url);
        setMeta('name', 'twitter:title', meta.title);
        setMeta('name', 'twitter:description', meta.description);
    }, [pathname]);

    return null;
}
