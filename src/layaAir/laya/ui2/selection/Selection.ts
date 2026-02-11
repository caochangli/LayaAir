import { Input } from "../../display/Input";
import { Event } from "../../events/Event";
import { GButton } from "../GButton";
import { ButtonMode, LayoutType, SelectionMode } from "../Const";
import type { GPanel } from "../GPanel";
import type { GWidget } from "../GWidget";
import { ISelection } from "./ISelection";
import { UIEvent } from "../UIEvent";
import { ControllerRef } from "../ControllerRef";
import { NodeFlags } from "../../Const";

export class Selection implements ISelection {
    scrollItemToViewOnClick: boolean = false;
    /**caochangli - 允许右键选中，默认值修改成false */
    allowSelectByRightClick: boolean = false;

    /**caochangli - 增加允许点击选中，默认false */
    allowSelectedByClick:boolean = false;

    /**caochangli - 增加选中记录 */
    protected _selectedIndexs:Array<number>;
    get selectedIndexs():Array<number>
    {
        return this._selectedIndexs;
    }

    /**是否使用改版选中逻辑 */
    protected _useChangeSelected:boolean = true;

    protected _owner: GPanel;
    protected _mode: SelectionMode = 0;
    protected _lastIndex: number = 0;
    protected _triggerFocusEvents: boolean;
    protected _keyEvent: string;
    protected _controller: ControllerRef;

    constructor(owner: GPanel) {
        this._owner = owner;
        this._lastIndex = -1;
    }

    get mode(): SelectionMode {
        return this._mode;
    }
    set mode(value: SelectionMode) {
        this._mode = value;
    }

    get index(): number {
        // caochangli - 换成selectedIndexs处理(更高效)
        if (this._useChangeSelected)
            return this._selectedIndexs && this._selectedIndexs.length ? this._selectedIndexs[0] : -1;

        return this._owner.children.findIndex(obj => (obj instanceof GButton) && obj.selected);  
    }

    set index(value: number) {
        if (value >= 0 && value < this._owner.numChildren) {
            if (this._mode != SelectionMode.Single)
                this.clear();
            this.add(value);
        }
        else
            this.clear();
    }

    get controller(): ControllerRef {
        return this._controller;
    }

    set controller(value: ControllerRef) {
        if (this._controller)
            this._controller.release();
        this._controller = value;
        if (value) {
            value.validate();
            value.onChanged = this.selectChanged.bind(this);
            this.selectChanged();
        }
    }

    get(out?: number[]): number[] {
        // caochangli - 换成selectedIndexs处理(更高效)
        if (this._useChangeSelected)
            return this._selectedIndexs;

        if (!out)
            out = [];

        for (let i = 0, cnt = this._owner.children.length; i < cnt; i++) {
            let obj = this._owner.children[i];
            if ((obj instanceof GButton) && obj.selected)
                out.push(i);
        }

        return out;
    }

    add(index: number, scrollItToView?: boolean): void {
        if (this._mode == SelectionMode.Disabled)
            return;

        if (this._mode == SelectionMode.Single)
            this.clear();

        if (scrollItToView)
            this._owner.scroller?.scrollTo(index);

        this._lastIndex = index;
        let obj: GWidget;
        if (this._owner._getBit(NodeFlags.EDITING_NODE))
            obj = <GWidget>this._owner.children.filter(child => !(<any>child._extra).isTemplateNode)[index];
        else
            obj = this._owner.getChildAt(index);

        // caochangli - 添加选中索引
        this._addSelectedIndex(index);

        if ((obj instanceof GButton) && !obj.selected)
            obj.selected = true;

        this.syncController(index);
    }

    remove(index: number): void {
        if (this._mode == SelectionMode.Disabled)
            return;

        let obj: GWidget;
        if (this._owner._getBit(NodeFlags.EDITING_NODE))
            obj = <GWidget>this._owner.children.filter(child => !(<any>child._extra).isTemplateNode)[index];
        else
            obj = this._owner.getChildAt(index);

        // caochangli - 删除选中索引
        this._removeSelectedIndex(index);

        if (obj instanceof GButton && obj.selected)
            obj.selected = false;
    }

    clear(): void {
        // caochangli - 换成selectedIndexs处理(更高效)
        if (this._useChangeSelected)
        {
            if (!this._selectedIndexs || this._selectedIndexs.length <= 0)
                return;
            let obj: GWidget;
            for (let i = 0,length = this._selectedIndexs.length; i < length; i++)
            {
                obj = this._owner.getChildAt(this._selectedIndexs[i]);
                if ((obj instanceof GButton) && obj.selected && !(<any>obj._extra).isTemplateNode)
                    obj.selected = false;
            }
            this._selectedIndexs.length = 0;
            return;
        }

        for (let obj of this._owner.children) {
            if ((obj instanceof GButton) && !(<any>obj._extra).isTemplateNode)
                obj.selected = false;
        }                 
    }

    protected clearExcept(g: GWidget,exceptIndex:number): void {
        // caochangli - 换成selectedIndexs处理(更高效)
        if (this._useChangeSelected)
        {
            if (!this._selectedIndexs || this._selectedIndexs.length <= 0)
                return;
            let obj: GWidget;
            for (let length = this._selectedIndexs.length,i = length - 1; i >= 0; i--)
            {
                obj = this._owner.getChildAt(this._selectedIndexs[i]);
                if (obj != g)
                {
                    if ((obj instanceof GButton) && obj.selected && !(<any>obj._extra).isTemplateNode)
                        obj.selected = false;
                    this._selectedIndexs.splice(i,1);
                }
            }
            return;
        }

        for (let obj of this._owner.children) {
            if ((obj instanceof GButton) && obj != g && !(<any>obj._extra).isTemplateNode)
                obj.selected = false;
        }        
    }

    selectAll(): void {
        // caochangli - 更高效
        if (this._useChangeSelected)
        {
            let children = this._owner.children;
            let length = children.length;
            if (length <= 0)
                return;
            if (!this._selectedIndexs)
                this._selectedIndexs = [];
            else
                this._selectedIndexs.length = 0;
            let obj;
            for (let i = 0; i < length; i++)
            {
                obj = children[i];
                if ((obj instanceof GButton) && !obj.selected) {
                    obj.selected = true;
                }
                this._selectedIndexs.push(i);
            }
            return;
        }

        for (let obj of this._owner.children) {
            if ((obj instanceof GButton) && !obj.selected) {
                obj.selected = true;
            }
        }
    }

    selectReverse(): void {
        // caochangli - 更高效
        if (this._useChangeSelected)
        {
            let children = this._owner.children;
            let length = children.length;
            if (length <= 0)
                return;
            if (!this._selectedIndexs)
                this._selectedIndexs = [];
            else
                this._selectedIndexs.length = 0;
            let obj;
            let curSelected;
            for (let i = 0; i < length; i++)
            {
                obj = children[i];
                if ((obj instanceof GButton)) {
                    curSelected = !obj.selected;
                    obj.selected = curSelected;
                    if (curSelected) 
                        this._selectedIndexs.push(i);
                }
            }
            return;
        }
        
        for (let obj of this._owner.children) {
            if (obj instanceof GButton) {
                obj.selected = !obj.selected;
            }
        }
    }

    enableFocusEvents(enabled: boolean) {
        if (this._triggerFocusEvents == enabled)
            return;

        this._triggerFocusEvents = enabled;

        // if (enabled) {
        //     //this._owner.tabStopChildren = true;
        //     this._owner.on("focus_in", this, this.handleFocus);
        //     this._owner.on("focus_out", this, this.handleFocus);
        // }
        // else {
        //     this._owner.off("focus_in", this, this.handleFocus);
        //     this._owner.off("focus_out", this, this.handleFocus);
        // }
    }

    private handleFocus(evt: Event) {
        let eventType = evt.type == "focus_in" ? "list_focus_in" : "list_focus_out";
        for (let obj of this._owner.children) {
            if ((obj instanceof GButton) && obj.selected)
                obj.event(eventType);
        }
    }

    handleClick(item: GButton, evt: Event): void {
        let scroller = this._owner.scroller;
        if (scroller?.isDragged)
            return;

        if (evt.button == 2 && !this.allowSelectByRightClick)
            return;

        // caochangli - 不允许点击选中
        if (evt.button == 0 && !this.allowSelectedByClick)
            return;

        if (item.mode == ButtonMode.Common) {
            this._owner.event(UIEvent.ClickItem, [item, evt]);
            return;
        }
 
        let dontChangeLastIndex = false;
        let index = this._owner.getChildIndex(item);

        if (this._mode == SelectionMode.Disabled) {
            //nothing
        }
        // caochangli - 单选：只能选中不能取消？- 给ComboBox用的？
        else if (this._mode == SelectionMode.Single) {
            if (!item.selected) {
                this.clearExcept(item,index);
                // caochangli - 添加选中索引
                this._addSelectedIndex(index);
                item.selected = true;
                item.event(Event.CHANGED);
            }
        }
        // caochangli - 多选
        else {
            // caochangli - 按住shift：只能选中不能取消？
            if (evt.shiftKey) {
                if (!item.selected) {
                    if (this._lastIndex != -1) {
                        let min = Math.min(this._lastIndex, index);
                        let max = Math.max(this._lastIndex, index);
                        max = Math.min(max, this._owner.numChildren - 1);

                        for (let i = min; i <= max; i++) {
                            let obj = this._owner.getChildAt(i);
                            if (obj instanceof GButton) {
                                // caochangli - 添加选中索引
                                this._addSelectedIndex(i);
                                obj.selected = true;
                                if (obj == item)
                                    item.event(Event.CHANGED);
                            }
                        }

                        dontChangeLastIndex = true;
                    }
                    else {
                        // caochangli - 添加选中索引
                        this._addSelectedIndex(index);
                        item.selected = true;
                        item.event(Event.CHANGED);
                    }
                }
            }
            // caochangli - 按住ctrl或meta或多选单击实现：可选中可取消
            else if ((evt.ctrlKey || evt.metaKey) || this._mode == SelectionMode.MultipleBySingleClick) {
                // item.selected = !item.selected;
                let curSelected = !item.selected;
                item.selected = curSelected;
                // caochangli - 添加、删除选中索引
                if (curSelected)
                    this._addSelectedIndex(index);
                else
                    this._removeSelectedIndex(index);
                item.event(Event.CHANGED);
            }
            else {
                // caochangli - 只能选中
                if (!item.selected) {
                    this.clearExcept(item,index);
                    // caochangli - 添加选中索引
                    this._addSelectedIndex(index);
                    item.selected = true;
                    item.event(Event.CHANGED);
                }
                // caochangli - 多余调用
                // else if (evt.button == 0)
                //     this.clearExcept(item,index);
            }
        }

        if (!dontChangeLastIndex)
            this._lastIndex = index;

        if (scroller && this.scrollItemToViewOnClick)
            scroller.scrollTo(item, true);

        if (item.selected)
            this.syncController(index);

        if (evt.isDblClick && (evt.target instanceof Input))
            return;

        this._owner.event(UIEvent.ClickItem, [item, evt]);
    }

    enableArrowKeyNavigation(enabled: boolean, keySelectEvent?: string) {
        if (enabled) {
            //this._owner.tabStopChildren = true;
            this._keyEvent = keySelectEvent != null ? keySelectEvent : UIEvent.ClickItem;
            this._owner.on(Event.KEY_DOWN, this, this._keydown);
        }
        else {
            //this._owner.tabStopChildren = false;
            this._owner.off(Event.KEY_DOWN, this, this._keydown);
        }
    }

    private _keydown(evt: Event) {
        if ((evt.target instanceof Input) || evt.ctrlKey || evt.metaKey || evt.altKey || evt.shiftKey)
            return;

        let index = -1;
        switch (evt.key) {
            case "ArrowLeft":
                index = this.handleArrowKey(7, evt);
                break;

            case "ArrowRight":
                index = this.handleArrowKey(3, evt);
                break;

            case "ArrowUp":
                index = this.handleArrowKey(1, evt);
                break;

            case "ArrowDown":
                index = this.handleArrowKey(5, evt);
                break;
        }

        if (index != -1)
            evt.stopPropagation();
    }

    handleArrowKey(dir: number, evt?: Event): number {
        let curIndex = this.index;
        if (curIndex == -1) {
            if (this._owner.numChildren > 0) {
                this.clear();
                this.add(0, true);
                if (this._keyEvent)
                    this._owner.event(this._keyEvent, [this._owner.getChildAt(0), evt]);
                return 0;
            }
            else
                return -1;
        }

        let index = curIndex;
        let layout = this._owner.layout?.type;
        if (layout == null)
            layout = LayoutType.FlowX;

        switch (dir) {
            case 1://up
                if (layout == LayoutType.SingleColumn || layout == LayoutType.FlowY) {
                    index--;
                }
                else if (layout == LayoutType.FlowX) {
                    let current = <GWidget>this._owner.getChildAt(index);
                    let k = 0;
                    let i;
                    for (i = index - 1; i >= 0; i--) {
                        let obj = <GWidget>this._owner.getChildAt(i);
                        if (obj.y != current.y) {
                            current = obj;
                            break;
                        }
                        k++;
                    }
                    for (; i >= 0; i--) {
                        let obj = <GWidget>this._owner.getChildAt(i);
                        if (obj.y != current.y) {
                            index = i + k + 1;
                            break;
                        }
                    }

                }
                break;

            case 3://right
                if (layout == LayoutType.SingleRow || layout == LayoutType.FlowX) {
                    index++;
                }
                else if (layout == LayoutType.FlowY) {
                    let current = <GWidget>this._owner.getChildAt(index);
                    let k = 0;
                    let i;
                    let cnt = this._owner.numChildren;
                    for (i = index + 1; i < cnt; i++) {
                        let obj = <GWidget>this._owner.getChildAt(i);
                        if (obj.x != current.x) {
                            current = obj;
                            break;
                        }
                        k++;
                    }
                    for (; i < cnt; i++) {
                        let obj = <GWidget>this._owner.getChildAt(i);
                        if (obj.x != current.x) {
                            index = i - k - 1;
                            break;
                        }

                    }
                }
                break;

            case 5://down
                if (layout == LayoutType.SingleColumn || layout == LayoutType.FlowY) {
                    index++;
                }
                else if (layout == LayoutType.FlowX) {
                    let current = <GWidget>this._owner.getChildAt(index);
                    let k = 0;
                    let i;
                    let cnt = this._owner.numChildren;
                    for (i = index + 1; i < cnt; i++) {
                        let obj = <GWidget>this._owner.getChildAt(i);
                        if (obj.y != current.y) {
                            current = obj;
                            break;
                        }
                        k++;
                    }
                    for (; i < cnt; i++) {
                        let obj = <GWidget>this._owner.getChildAt(i);
                        if (obj.y != current.y) {
                            index = i - k - 1;
                            break;
                        }
                    }
                }
                break;

            case 7://left
                if (layout == LayoutType.SingleRow || layout == LayoutType.FlowX) {
                    index--;
                }
                else if (layout == LayoutType.FlowY) {
                    let current = <GWidget>this._owner.getChildAt(index);
                    let k = 0;
                    let i;
                    for (i = index - 1; i >= 0; i--) {
                        let obj = <GWidget>this._owner.getChildAt(i);
                        if (obj.x != current.x) {
                            current = obj;
                            break;
                        }
                        k++;
                    }
                    for (; i >= 0; i--) {
                        let obj = <GWidget>this._owner.getChildAt(i);
                        if (obj.x != current.x) {
                            index = i + k + 1;
                            break;
                        }
                    }
                }
                break;
        }

        if (index != curIndex && index >= 0 && index < this._owner.numChildren) {
            this.clear();
            this.add(index, true);
            if (this._keyEvent) {
                this._owner.event(this._keyEvent, [this._owner.getChildAt(index), evt]);
            }
            return index;
        }
        else
            return -1;
    }

    private selectChanged() {
        if (this._controller)
            this.index = this._controller.selectedIndex;
    }

    private syncController(index: number) {
        let cc = this._controller;
        if (cc) {
            this._controller = null;
            cc.selectedIndex = index;
            this._controller = cc;
        }
    }

    _refresh() {
        if (this._mode === SelectionMode.None)
            return;

        if (this._controller)
            this.index = this._controller.selectedIndex;
        else
            this.index = this._lastIndex;
    }

    destroy() {
        if (this._controller)
            this._controller.release();
    }



//#region 功能扩展

    /**获取选中的Item */
    get selectedItem():GWidget | null {
        let index = this.index;
        if (index == -1)
            return null;
        return this._owner.getChildAt(index);
    }

    /**获取选中的Item列表 */
    get selectedItems():Array<GWidget> | null {
        let indexs = this.get();
        if (!indexs || indexs.length <= 0)
            return null;
        let result = [];
        for (let i = 0,length = indexs.length; i < length; i++)
        {
            let obj = this._owner.getChildAt(indexs[i]);
            if (obj)
                result.push(obj);
        }
        return result;
    }

    /**当前正在渲染的Item列表 */
    get rendererItems():Array<GWidget> | null {
        return this._owner.children as any;
    }

    // caochangli - 添加选中索引
    protected _addSelectedIndex(index:number):void {
        if (!this._useChangeSelected) return;
        if (!this._selectedIndexs)
            this._selectedIndexs = [];
        else if (this._selectedIndexs.indexOf(index) >= 0)
            return;
        this._selectedIndexs.push(index);    
    }
    // caochangli - 删除选中索引
    protected _removeSelectedIndex(index:number):void {
        if (!this._useChangeSelected) return;
        if (!this._selectedIndexs)
            return;
        let sIndex = this._selectedIndexs.indexOf(index);
        if (sIndex >= 0)
            this._selectedIndexs.splice(sIndex,1);   
    }
//#endregion
}