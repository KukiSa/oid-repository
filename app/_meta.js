export default {
    index: {
        title: 'Signaliks OID Repository',
        display: 'hidden',
        theme: {
            sidebar: false,
            layout: 'full',
            toc: false
        }
    },

    homepage: {
        title: 'Home',
        type: 'page',
        href: 'https://iks.moe/'
    },

    blog: {
        title: 'Blog',
        type: 'page',
        href: 'https://blog.iks.moe'
    },

    oids: {
        title: 'OIDs',
        type: 'menu',
        items: {
            "1.3.6.1.4.1.65553": {
                title: '1.3.6.1.4.1.65553',
                href: '/1.3.6.1.4.1.65553/'
            }
        }
    }
}
