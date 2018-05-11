
export interface IHabitatItem {
    contentType: string;
    uuid: string;
}

export interface IHabitatPageInfo {
    href: string;
}

export interface IContentUpdateMessage {
    action: string;
    pageInfo: IHabitatPageInfo;
    selection: string[];
    items: IHabitatItem[];
}

export interface IContentActionMessage {
    action: string;
    item: string;
    selected: boolean;
}
