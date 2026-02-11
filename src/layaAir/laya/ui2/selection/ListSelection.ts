import { GButton } from "../GButton";
import { ButtonMode, LayoutType, SelectionMode } from "../Const";
import type { GList } from "../GList";
import type { ListLayout } from "../layout/ListLayout";
import { Selection } from "./Selection";
import { GWidget } from "../GWidget";
import { Event } from "../../events/Event";
import { Input } from "../../display/Input";
import { UIEvent } from "../UIEvent";

export class ListSelection extends Selection {
    declare _owner: GList;
    _layout: ListLayout;

    constructor(owner: GList) {
        super(owner);

        this._layout = <ListLayout>owner.layout;
    }

    get index(): number {
        if (this._layout._virtual) {
            // caochangli - 换成selectedIndexs处理(更高效)
            if (this._useChangeSelected)
                return this._selectedIndexs && this._selectedIndexs.length ? this._selectedIndexs[0] : -1;
            
            for (let i = 0; i < this._layout._realNumItems; i++) {
                let ii = this._layout._items[i];
                if ((ii.obj instanceof GButton) && ii.obj.selected || ii.obj == null && ii.selected) {
                    if (this._layout._loop)
                        return i % this._layout.numItems;
                    else
                        return i;
                }
            }
            return -1;
        }
        else
            return super.index;
    }

    set index(value: number) {
        if (this._layout._virtual) {
            if (value >= 0 && value < this._layout.numItems) {
                if (this._mode != SelectionMode.Single)
                    this.clear();
                this.add(value);
            }
            else
                this.clear();
        }
        else
            super.index = value;
    }

    get(out?: number[]): number[] {
        if (this._layout._virtual) {
            // caochangli - 换成selectedIndexs处理(更高效)
            if (this._useChangeSelected)
                return this._selectedIndexs;

            if (!out)
                out = [];

            for (let i = 0; i < this._layout._realNumItems; i++) {
                let ii = this._layout._items[i];
                if ((ii.obj instanceof GButton) && ii.obj.selected
                    || ii.obj == null && ii.selected) {
                    let j = i;
                    if (this._layout._loop) {
                        j = i % this._layout.numItems;
                        if (out.indexOf(j) != -1)
                            continue;
                    }
                    out.push(j);
                }
            }

            return out;
        }
        else
            return super.get(out);
    }

    add(index: number, scrollItToView?: boolean): void {
        if (this._layout._virtual) {
            if (this._mode == SelectionMode.Disabled)
                return;

            this._layout._checkVirtualList();

            if (this._mode == SelectionMode.Single)
                this.clear();

            if (scrollItToView)
                this._owner.scroller.scrollTo(index);

            this._lastIndex = index;
            // let obj: GWidget;
            // let ii = this._layout._items[index];
            // if (ii.obj)
            //     obj = ii.obj;
            // ii.selected = true;

            // if ((obj instanceof GButton) && !obj.selected)
            //     obj.selected = true;

            // caochangli - 修复无限循环列表选中逻辑BUG
            this._setSelectedIndex(index,true);
        }
        else
            super.add(index, scrollItToView);
    }

    remove(index: number): void {
        if (this._layout._virtual) {
            if (this._mode == SelectionMode.Disabled)
                return;

            // let obj: GWidget;
            // let ii = this._layout._items[index];
            // if (ii.obj)
            //     obj = ii.obj;
            // ii.selected = false;

            // if (obj instanceof GButton && obj.selected)
            //     obj.selected = false;

            // caochangli - 修复无限循环列表选中逻辑BUG
            this._setSelectedIndex(index,false);
        }
        else
            super.remove(index);
    }

    clear(): void {
        if (this._layout._virtual) {
            // caochangli - 换成selectedIndexs处理(更高效)
            if (this._useChangeSelected)
            {   
                if (!this._selectedIndexs || this._selectedIndexs.length <= 0)
                    return;
                for (let i = 0,length = this._selectedIndexs.length; i < length; i++)
                {
                    this._setSelectedIndex(this._selectedIndexs[i],false,false);
                }
                this._selectedIndexs.length = 0;
                return;
            }

            for (let i = 0; i < this._layout._realNumItems; i++) {
                let ii = this._layout._items[i];
                if (ii.obj instanceof GButton)
                    ii.obj.selected = false;
                ii.selected = false;
            }
        }
        else
            super.clear();
    }

    protected clearExcept(g: GWidget,exceptIndex:number): void {
        if (this._layout._virtual) {
            // caochangli - 换成selectedIndexs处理(更高效)
            if (this._useChangeSelected)
            {
                if (!this._selectedIndexs || this._selectedIndexs.length <= 0)
                    return;
                for (let length = this._selectedIndexs.length,i = length - 1; i >= 0; i--)
                {
                    let index = this._selectedIndexs[i];
                    if (index != exceptIndex)
                    {
                        this._setSelectedIndex(index,false,false);
                        this._selectedIndexs.splice(i,1);
                    }
                }
                return;
            }

            for (let i = 0; i < this._layout._realNumItems; i++) {
                let ii = this._layout._items[i];
                if (ii.obj != g) {
                    if ((ii.obj instanceof GButton))
                        ii.obj.selected = false;
                    ii.selected = false;
                }
            }
        }
        else
            super.clearExcept(g,exceptIndex);
    }

    selectAll(): void {
        if (this._layout._virtual) {
            this._layout._checkVirtualList();

            // caochangli - 更高效
            if (this._useChangeSelected)
            {
                let realNumItems = this._layout._realNumItems;
                if (realNumItems <= 0)
                    return;
                let item = this._layout._items;
                let numItems = this._layout.numItems;
                if (!this._selectedIndexs)
                    this._selectedIndexs = [];
                else
                    this._selectedIndexs.length = 0;
                for (let i = 0; i < realNumItems; i++) {
                    let ii = item[i];
                    if ((ii.obj instanceof GButton) && !ii.obj.selected) {
                        ii.obj.selected = true;
                    }
                    ii.selected = true;
                    if (i < numItems)
                        this._selectedIndexs.push(i);
                }
                return;
            }

            for (let i = 0; i < this._layout._realNumItems; i++) {
                let ii = this._layout._items[i];
                if ((ii.obj instanceof GButton) && !ii.obj.selected) {
                    ii.obj.selected = true;
                }
                ii.selected = true;
            }
        }
        else
            super.selectAll();
    }

    selectReverse(): void {
        if (this._layout._virtual) {
            this._layout._checkVirtualList();

            // caochangli - 更高效
            if (this._useChangeSelected)
            {
                let realNumItems = this._layout._realNumItems;
                if (realNumItems <= 0)
                    return;
                let item = this._layout._items;
                let numItems = this._layout.numItems;
                if (!this._selectedIndexs)
                    this._selectedIndexs = [];
                else
                    this._selectedIndexs.length = 0;
                for (let i = 0; i < realNumItems; i++) {
                    let ii = item[i];
                    let curSelected = !ii.selected;
                    if ((ii.obj instanceof GButton)) {
                        ii.obj.selected = curSelected;
                    }
                    ii.selected = curSelected;
                    if (curSelected && i < numItems)
                        this._selectedIndexs.push(i);
                }
                return;
            }

            for (let i = 0; i < this._layout._realNumItems; i++) {
                let ii = this._layout._items[i];
                if (ii.obj instanceof GButton) {
                    ii.obj.selected = !ii.obj.selected;
                }
                ii.selected = !ii.selected;
            }
        }
        else
            super.selectReverse();
    }

    handleClick(item: GButton, evt: Event): void {
        if (this._layout._virtual) {
            let scroller = this._owner.scroller;
            if (scroller?.isDragged)
                return;

            if (evt.button === 2 && !this.allowSelectByRightClick)
                return;

            // caochangli - 不允许点击选中
            if (evt.button == 0 && !this.allowSelectedByClick)
                return;

            if (item.mode == ButtonMode.Common) {
                this._owner.event(UIEvent.ClickItem, [item, evt]);
                return;
            }

            let dontChangeLastIndex = false;
            let index = this._layout.childIndexToItemIndex(this._owner.getChildIndex(item));

            if (this._mode == SelectionMode.Disabled) {
                //nothing
            }
            // caochangli - 单选：只能选中不能取消？- 给ComboBox用的？
            else if (this._mode == SelectionMode.Single) {
                if (!item.selected) {
                    this.clearExcept(item,index);
                    // item.selected = true;
                    // caochangli - 修复无限循环列表选中逻辑BUG
                    this._setSelectedIndex(index,true);
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
                            max = Math.min(max, this._layout.numItems - 1);

                            for (let i = min; i <= max; i++) {
                                // caochangli - 修复无限循环列表选中逻辑BUG
                                this._setSelectedIndex(i,true);
                                let ii = this._layout._items[i];
                                if (ii.obj instanceof GButton) {
                                    // ii.obj.selected = true;
                                    if (ii.obj == item)
                                        item.event(Event.CHANGED);
                                }
                                // ii.selected = true;
                            }

                            dontChangeLastIndex = true;
                        }
                        else {
                            // item.selected = true;
                            // caochangli - 修复无限循环列表选中逻辑BUG
                            this._setSelectedIndex(index,true);
                            item.event(Event.CHANGED);
                        }
                    }
                }
                // caochangli - 按住ctrl或meta或多选单击实现：可选中可取消
                else if ((evt.ctrlKey || evt.metaKey) || this._mode == SelectionMode.MultipleBySingleClick) {
                    // item.selected = !item.selected;
                    // caochangli - 修复无限循环列表选中逻辑BUG
                    this._setSelectedIndex(index,!item.selected);
                    item.event(Event.CHANGED);
                }
                else {
                    // caochangli - 只能选中
                    if (!item.selected) {
                        this.clearExcept(item,index);
                        // item.selected = true;
                        // caochangli - 修复无限循环列表选中逻辑BUG
                        this._setSelectedIndex(index,true);
                        item.event(Event.CHANGED);
                    }
                    // caochangli - 多余调用
                    // else if (evt.button == 0)
                    //     this.clearExcept(item,index);
                }
            }

            if (!dontChangeLastIndex)
                this._lastIndex = index;

            if (evt.isDblClick && (evt.target instanceof Input))
                return;

            this._owner.event(UIEvent.ClickItem, [item, evt]);
        }
        else
            super.handleClick(item, evt);
    }

    handleArrowKey(dir: number, evt?: Event): number {
        if (this._layout._virtual) {
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
            let layout = this._layout.type;
            switch (dir) {
                case 1://up
                    if (layout == LayoutType.SingleColumn || layout == LayoutType.FlowY) {
                        index--;
                    }
                    else if (layout == LayoutType.FlowX) {
                        index -= this._layout._lineItemCnt;
                    }
                    break;

                case 3://right
                    if (layout == LayoutType.SingleRow || layout == LayoutType.FlowX) {
                        index++;
                    }
                    else if (layout == LayoutType.FlowY) {
                        index += this._layout._lineItemCnt;
                    }
                    break;

                case 5://down
                    if (layout == LayoutType.SingleColumn || layout == LayoutType.FlowY) {
                        index++;
                    }
                    else if (layout == LayoutType.FlowX) {
                        index += this._layout._lineItemCnt;
                    }
                    break;

                case 7://left
                    if (layout == LayoutType.SingleRow || layout == LayoutType.FlowX) {
                        index--;
                    }
                    else if (layout == LayoutType.FlowY) {
                        index -= this._layout._lineItemCnt;
                    }
                    break;
            }

            if (index != curIndex && index >= 0 && index < this._layout.numItems) {
                this.clear();
                this.add(index, true);
                if (this._keyEvent) {
                    let childIndex = this._layout.itemIndexToChildIndex(index);
                    if (childIndex != -1)
                        this._owner.event(this._keyEvent, [this._owner.getChildAt(childIndex), evt]);
                }
                return index;
            }
            else
                return -1;
        }
        else
            return super.handleArrowKey(dir, evt);
    }



//#region 功能扩展

    /**获取选中的Item */
    get selectedItem():GWidget | null {
        if (this._layout._virtual) 
        {
            let index = this.index;
            if (index == -1)
                return null;
            if (this._layout._loop) 
            {
                let item = this._layout._items;
                let realNumItems = this._layout._realNumItems;
                let numItems = this._layout.numItems;
                for (let i = index; i < realNumItems; i=i+numItems)
                {
                    let ii = item[i];
                    if (ii && ii.obj)
                        return ii.obj;
                }
                return null;
            }
            else 
            {
                let ii = this._layout._items[index];
                return ii ? ii.obj : null;
            }
        }
        else
            return super.selectedItem;
    }

    /**获取选中的Item列表 */
    get selectedItems():Array<GWidget> | null {
        if (this._layout._virtual) 
        {
            let indexs = this.get();
            if (!indexs || indexs.length <= 0)
                return null;
            let result = [];
            let items = this._layout._items;
            if (this._layout._loop) 
            {
                let realNumItems = this._layout._realNumItems;
                let numItems = this._layout.numItems;
                for (let i = 0,length = indexs.length; i < length; i++)
                {
                    for (let j = indexs[i]; j < realNumItems; j=j+numItems)
                    {
                        let ii = items[j];
                        if (ii && ii.obj)
                            result.push(ii.obj);
                    }
                }
                return result;
            }
            else 
            {
                for (let i = 0,length = indexs.length; i < length; i++)
                {
                    let ii = items[indexs[i]];
                    if (ii && ii.obj)
                        result.push(ii.obj);
                }
                return result;
            }
        }
        else
            return super.selectedItems;
    }

    /**当前正在渲染的Item列表 */
    get rendererItems():Array<GWidget> | null {
        if (this._layout._virtual) 
        {
            let realNumItems = this._layout._realNumItems;
            if (realNumItems <= 0)
                return null;
            let result = [];
            let items = this._layout._items;
            for (let i = 0; i < realNumItems; i++)
            {
                let ii = items[i];
                if (ii && ii.obj)
                    result.push(ii.obj);
            }
            return result;
        }
        else
            return super.rendererItems;
    }

    // caochangli - 设置选择索引
    protected _setSelectedIndex(index:number,selected:boolean,isChangeRecord:boolean = true) {
        if (isChangeRecord)
        {
            if (selected)
                this._addSelectedIndex(index);
            else
                this._removeSelectedIndex(index);
        }
        
        if (this._layout._loop)
        {
            let items = this._layout._items;
            let realNumItems = this._layout._realNumItems;
            let numItems = this._layout.numItems;
            for (let i = index; i < realNumItems; i=i+numItems)
            {
                let ii = items[i];
                if (ii)
                {
                    ii.selected = selected;
                    if ((ii.obj instanceof GButton) && ii.obj.selected != selected)
                        ii.obj.selected = selected;
                }    
            }    
        }
        else
        {
            let obj: GWidget;
            let ii = this._layout._items[index];
            if (ii.obj)
                obj = ii.obj;
            ii.selected = selected;
            if ((obj instanceof GButton) && obj.selected != selected)
                obj.selected = selected;
        }
    } 
//#endregion
}