import { IContentActionMessage, IContentUpdateMessage, IHabitatItem } from './model';
/**
 * Content Script that gets injected in Inkling Habitat
 *
 * NOTE: Content scripts do not support ES6 modules
 */
const HABITAT_PORT_NAME: string = 'habitat';

let contentLoadHandler: () => void;

function deepEqual(obj1: object, obj2: object) {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
}

class HabitatInspector {
    private port: chrome.runtime.Port;
    private contentDocument: Document;
    private messagePayload: IContentUpdateMessage = {
        action: 'update',
        pageInfo: {
            href: '',
        },
        selection: [],
        items: [],
    };

    constructor(connect: (parameter: object) => chrome.runtime.Port = chrome.runtime.connect) {
        // Open the 'habitat<-->ext' communication channel between App and Chrome extension
        this.port = connect({ name: HABITAT_PORT_NAME });

        // Listen to messages coming over the 'habitat' channel
        this.port.onMessage.addListener(this.portListener.bind(this));

        this.observeNavigation();

        // Initial handshake with the chrome extension
        this.port.postMessage({ hello: 'I am Inkling Habitat' });

        contentLoadHandler = this.onContentLoad.bind(this);
    }

    /**
     * When user navigates from page to page in Habitat, we need to reparse the content
     */
    private observeNavigation(): void {
        const observer: MutationObserver = new MutationObserver(contentLoadHandler);
        observer.observe(document.getElementById('status-message'), { attributes: true });
    }

    private portListener(msg: IContentActionMessage): void {
        console.log('HABITAT RX MESSAHE', msg, this.contentDocument);
        if (msg.action === 'initialize' && this.contentDocument) {
            this.messagePayload.items = [];
            this.updateItems();
        }

        if (msg.action === 'select') {
            this.onItemSelection(msg.item, msg.selected);
        }
    }

    private onContentLoad(): void {
        this.messagePayload.pageInfo = {
            href: window.location.href,
        };

        const iframe: HTMLIFrameElement = document.querySelector('iframe');

        if (iframe) {
            const isIframeLoaded: boolean =
                !!iframe.contentDocument &&
                !!iframe.contentDocument.body &&
                !!iframe.contentDocument.body.innerHTML;

            if (isIframeLoaded) {
                this.onIframeLoad(iframe);
            } else {
                iframe.addEventListener('load', (evt: Event) => this.onIframeLoad(evt.target as HTMLIFrameElement));
            }
        } else {
            setTimeout(contentLoadHandler, 250);
        }
    }

    /**
     * Initialization when a new page loads in the Habitat content iframe
     */
    private onIframeLoad(iframe: HTMLIFrameElement): void {
        this.contentDocument = iframe.contentDocument;
        this.observeContent();
        this.injectStyleSheet();
    }

    /**
     * Observe any change made to the content
     *
     * @param {Document} contentDocument
     */
    private observeContent(): void {
        const observer: MutationObserver = new MutationObserver(this.updateItems.bind(this));
        observer.observe(this.contentDocument.body, { childList: true, subtree: true });
        this.updateItems();
    }

    private getItemList(): IHabitatItem[] {
        const items: NodeListOf<HTMLElement> = this.contentDocument.querySelectorAll('[data-uuid]');

        const blockElements: HTMLElement[] = Array.from(items).filter((el: HTMLElement) => {
            const tag = el.tagName.toLowerCase();
            if (tag === 'html') {
                // This is for page metadata
                return true;
            } else if (tag === 'iframe') {
                // This is an interactive pattern
                return true;
            } else {
                // this is a static pattern
                return (
                    el.textContent.trim() &&
                    (['p'].includes(tag) || /h[0-6]/.test(tag))
                );
            }
        });

        return blockElements.map((el: HTMLElement) => {
            const tag: string = el.tagName.toLowerCase();
            const uuid: string = el.dataset.uuid;

            let contentType: string = 'undefined';
            if (tag.startsWith('h')) {
                contentType = 'heading';
            }

            if (tag === 'iframe') {
                contentType = 'interaction';
            }

            if (tag === 'p') {
                contentType = 'paragraph';
            }

            if (tag === 'html') {
                contentType = 'page';
            }

            return { contentType, uuid };
        });
    }

    private updateItems(): void {
        const items: IHabitatItem[] = this.getItemList();
        const selectedItems: NodeListOf<HTMLElement> = this.contentDocument.querySelectorAll('.meta-highlight');
        this.messagePayload.selection = Array.from(selectedItems).map((el: HTMLElement) => el.dataset.uuid);

        // Note: we don't need to check if selection has changed, because it's only driven by the HMH Application (unidirectional)
        if (!deepEqual(items, this.messagePayload.items)) {
            this.messagePayload.items = items;
            this.port.postMessage({ ...this.messagePayload });
        }
    }

    private onItemSelection(uuid: string, selected: boolean): void {
        if (!this.contentDocument) {
            return;
        }

        const el: HTMLElement = this.contentDocument.querySelector(`[data-uuid="${uuid}"]`);
        console.log('SELECTING ELEMENT', el);
        el.classList.toggle('meta-highlight', selected);
    }

    /**
     * Inject stylesheet in the content iframe
     */
    private injectStyleSheet(): void {
        const styleEl: HTMLStyleElement = document.createElement('style');
        styleEl.textContent = '.meta-highlight { background-color: yellow; opacity: 0.5; }';
        this.contentDocument.body.appendChild(styleEl);
    }
}

self.addEventListener('load', () => new HabitatInspector(chrome.runtime.connect));
