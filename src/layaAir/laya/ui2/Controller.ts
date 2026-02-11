import { EventDispatcher } from "../events/EventDispatcher";
import type { GWidget } from "./GWidget";
import { Event } from "../events/Event";
import { ControllerRef } from "./ControllerRef";
import { Mutable } from "../../ILaya";
import { GearDisplay } from "./gear/GearDisplay";

/**
 * @en Controller class manages a set of pages, allowing for selection and change notifications.
 * @zh 控制器类管理一组页面，允许选择和更改通知。- 控制器修改默认不选中(IDE不好改，就没动了，也就是说IDE中设置的默认选中是无效的)
 */
export class Controller extends EventDispatcher {
    /** caochangli - 控制器修改默认不选中(IDE不好改，就没动了，也就是说IDE中设置的默认选中是无效的)
     * @zh 是否默认选中
     */
    protected _defaultSelected:boolean = false;

    private _selectedIndex: number;
    private _previousIndex: number;
    private _pages: string[];

    /** @readonly */
    owner: GWidget;
    /** @readonly */
    name: string;

    /**
     * @en Indicates whether the controller is currently changing.
     * @zh 指示控制器当前是否正在更改。
     */
    readonly changing: boolean;

    /**
     * @internal
     */
    _refs: Set<ControllerRef>;

    /** @ignore @blueprintIgnore */
    constructor() {
        super();

        this.name = "";
        this._pages = [];
        this._selectedIndex = -1;
        this._previousIndex = -1;
        this._refs = new Set();
    }

    /**
     * @en The direction in which the popup dropdown will appear.
     * @zh 弹出下拉列表将出现的方向。
     */
    get defaultSelected(): boolean
    {
        return this._defaultSelected;
    }
    set defaultSelected(value: boolean)
    {
        if (this._defaultSelected == value) return;
        this._defaultSelected = value;
    }

    /**
     * 根据索引选中页面 - caochangli：增加是否派发changed事件选项
     * @param index 索引
     * @param isSendChanged 是否派发changed事件，默认true
     */
    setSelectedIndex(index: number, isSendChanged:boolean = true) {
        this._setSelectedIndex(index,isSendChanged);
    }

    /**
     * 根据名称选中页面 - caochangli：增加是否派发changed事件选项
     * @param pageName 页面名称
     * @param isSendChanged 是否派发changed事件
     */
    setSelectedPage(pageName: string, isSendChanged:boolean = true) {
        let index = this._pages.indexOf(pageName);
        if (index === -1)
            index = 0;
        this._setSelectedIndex(index,isSendChanged);
    }

    /**
     * @en Pages of the controller.
     * @zh 控制器的页面。
     */
    get pages(): Array<string> {
        return this._pages;
    }

    set pages(value: Array<string>) {
        this._pages = value;

        // caochangli - 加是否默认选中开关
        if (this._defaultSelected && value.length > 0 && this._selectedIndex == -1)
            this.selectedIndex = 0;
    }

    /**
     * @en The number of pages in the controller.
     * @zh 控制器中的页面数量。
     */
    get numPages() {
        return this._pages.length;
    }

    set numPages(value: number) {
        this._pages.length = value;
        for (let i = 0; i < value; i++)
            if (this._pages[i] == null) this._pages[i] = "";
    }

    /**
     * @en Adds a new page to the controller.
     * @param name The name of the new page. If not provided, an empty string will be used.
     * @zh 向控制器添加一个新页面。
     * @param name 新页面的名称。如果未提供，将使用空字符串。
     */
    addPage(name?: string) {
        name = name || "";
        this._pages.push(name);

        // caochangli - 加是否默认选中开关
        if (this._defaultSelected && this._selectedIndex == -1)
            this.selectedIndex = 0;

        return this;
    }

    /**
     * @en Index of the currently selected page.
     * @zh 当前选中页面的索引。
     */
    get selectedIndex(): number {
        return this._selectedIndex;
    }

    set selectedIndex(value: number) {
        // if (this._pages.length == 0)
        //     return;

        // if (this._selectedIndex != value) {
        //     if (value > this._pages.length - 1) {
        //         console.warn(`index out of bounds: ${value}`);
        //         return;
        //     }

        //     this._previousIndex = this._selectedIndex;
        //     this._selectedIndex = value;

        //     (<Mutable<this>>this).changing = true;
        //     try {
        //         for (let ref of this._refs) {
        //             ref.onChanged(this);
        //         }
        //         GearDisplay.checkAll(this);
        //         this.event(Event.CHANGED);
        //     }
        //     finally {
        //         (<Mutable<this>>this).changing = false;
        //     }
        // }

        // caochangli - 方法提取，增加是否派发changed事件
        this._setSelectedIndex(value);
    }

    /**
     * @en Name of the currently selected page.
     * @zh 当前选中页面的名称。
     */
    get selectedPage(): string {
        if (this._selectedIndex < 0 || this._selectedIndex >= this._pages.length)
            return null;
        else
            return this._pages[this._selectedIndex];
    }

    set selectedPage(value: string) {
        let i = this._pages.indexOf(value);
        if (i === -1)
            i = 0;
        this.selectedIndex = i;
    }

    /**
     * @en Index of the previously selected page.
     * @zh 上一个选中页面的索引。
     */
    get previousIndex(): number {
        return this._previousIndex;
    }

    /**
     * @en Index of the opposite page. ie. If the current index is 0, the opposite index will be 1, else if the current index is greate than 0, the opposite index will be 0.
     * @zh 相反页面的索引。即如果当前索引为0，则相反索引为1；如果当前索引大于0，则相反索引为0。
     */
    set oppositeIndex(value: number) {
        if (value > 0)
            this.selectedIndex = 0;
        else if (this._pages.length > 1)
            this.selectedIndex = 1;
    }

    // caochangli - set selectedIndex方法提取到此处，增加是否派发changed事件逻辑
    private _setSelectedIndex(value:number, isSendChanged:boolean = true) {
        if (this._pages.length == 0)
            return;

        if (this._selectedIndex != value) {
            if (value > this._pages.length - 1) {
                console.warn(`index out of bounds: ${value}`);
                return;
            }

            this._previousIndex = this._selectedIndex;
            this._selectedIndex = value;

            (<Mutable<this>>this).changing = true;
            try {
                for (let ref of this._refs) {
                    ref.onChanged(this);
                }
                GearDisplay.checkAll(this);
                if (isSendChanged)
                    this.event(Event.CHANGED,this);
            }
            finally {
                (<Mutable<this>>this).changing = false;
            }
        }
    }

    /** @internal @blueprintEvent */
    Controller_bpEvent: {
        [Event.CHANGED]: () => void;
    };
}