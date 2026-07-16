import { GWidget } from "./GWidget";
import { ITextCmd, ITextLine, Text, Text_cleanCmd, Text_cmdPool, Text_ellipsisStr, Text_emojiTest, Text_escapeCharsPattern, Text_getReplaceStr, Text_isHighSurrogate, Text_isLowSurrogate, Text_linePool, Text_maxWordLength, Text_normalizeCR, Text_punctuationChars, Text_recoverLines, Text_wordBoundaryTest } from "../display/Text";
import { HideFlags, NodeFlags } from "../Const";
import { TextFitContent } from "./Const";
import { SerializeUtil } from "../loaders/SerializeUtil";
import { SpriteConst, TransformKind } from "../display/SpriteConst";
import { Translations } from "./Translations";
import { Event } from "../events/Event";
import { Config } from "../../Config";
import { ILaya } from "../../ILaya";
import { LayaEnv } from "../../LayaEnv";
import { BitmapFont } from "../display/BitmapFont";
import { DrawRectCmd } from "../display/cmd/DrawRectCmd";
import { FillTextCmd } from "../display/cmd/FillTextCmd";
import { TextStyle } from "../display/css/TextStyle";
import { IGraphicsCmd } from "../display/IGraphics";
import { Render2DProcessor } from "../display/Render2DProcessor";
import { Sprite } from "../display/Sprite";
import { HtmlElement, HtmlElementType } from "../html/HtmlElement";
import { HtmlLink } from "../html/HtmlLink";
import { HtmlParseOptions } from "../html/HtmlParseOptions";
import { HtmlParser } from "../html/HtmlParser";
import { IHtmlObject } from "../html/IHtmlObject";
import { UBBParser } from "../html/UBBParser";
import { Point } from "../maths/Point";
import { Rectangle } from "../maths/Rectangle";
import { AssetDb } from "../resource/AssetDb";
import { AssetGroup, IAssetGroup } from "../sgsExpand/loader/AssetGroup";
import { Browser } from "../utils/Browser";
import { ColorUtils } from "../utils/ColorUtils";
import { Pool } from "../utils/Pool";
import { Utils } from "../utils/Utils";
import { TextRender } from "../webgl/text/TextRender";
import { TextRenderConfig } from "../webgl/text/TextRenderConfig";
import { Node } from "../display/Node";

/**
 * @en GTextField is a widget that displays text with various formatting options, including font, size, color, alignment, and more.
 * @zh GTextField 是一个显示文本的小部件，支持多种格式选项，包括字体、大小、颜色、对齐方式等。
 * - caochangli：修改GTextField节点嵌套写法(将Text.ts源码直接拿到GTextField中)
 * @blueprintInheritable
 */
export class GTextField extends GWidget {
    
    /**
     * @en Mark whether this text ignores the language pack.
     * @zh 标记此文本是否忽略语言包。
     */
    ignoreLang: boolean;

    /**
     * @en Represents the text content string.
     * @zh 表示文本内容字符串。
     */
    protected _text: string = "";

    /**
     * @en Represents the text overflow property.
     * @zh 表示文本的溢出属性。
     */
    protected _overflow: string = Text.VISIBLE;

    /**
     * @en Split render.
     * @zh 拆分渲染。
     */
    protected _singleCharRender: boolean = false;
    protected _textStyle: TextStyle;
    protected _prompt: string = '';

    /**
     * @en The color of the input prompt.
     * @zh 输入提示符颜色。
     */
    protected _promptColor: string;

    /**
     * @en The background color of the text, represented as a string.
     * @zh 文本背景颜色，以字符串表示。
     */
    protected _bgColor: string;

    /**
     * @en The border color of the text background, represented as a string.
     * @zh 文本边框背景颜色，以字符串表示。
     */
    protected _borderColor: string;

    /**
     * @en The default padding information.
     * [top padding, right padding, bottom padding, left padding] (in pixels).
     * @zh 默认边距信息
     * [上边距，右边距，下边距，左边距]（边距以像素为单位）。
     */
    protected _padding: number[];


    /**
     * @en Indicates whether the text field using this text format automatically wraps.
     * If the value of wordWrap is true, the text field automatically wraps; if the value is false, the text field does not automatically wrap.
     * @zh 表示使用此文本格式的文本字段是否自动换行。
     * 如果 wordWrap 的值为 true，则该文本字段自动换行；如果值为 false，则该文本字段不自动换行。
     */
    protected _wordWrap: boolean = false;

    /**
     * @internal
     * @en Specifies whether the text field is a password text field.
     * If the value of this property is true, the text field is considered a password text field and uses asterisks to hide the input characters instead of the actual characters. If false, the text field is not considered a password text field.
     * @zh 指定文本字段是否是密码文本字段。
     * 如果此属性的值为 true，则文本字段被视为密码文本字段，并使用星号而不是实际字符来隐藏输入的字符。如果为 false，则不会将文本字段视为密码文本字段。
     */
    protected _asPassword: boolean = false;

    protected _htmlParseOptions: HtmlParseOptions;

    protected _templateVars: Record<string, string>;

    /**
     * @en Indicates whether the text content has changed.
     * @zh 表示文本内容是否发生改变。
     */
    protected _isChanged: boolean;

    /**
     * @en Indicates the width of the text in pixels.
     * @zh 表示文本的宽度，以像素为单位。
     */
    protected _textWidth: number = 0;

    /**
     * @en Indicates the height of the text in pixels.
     * @zh 表示文本的高度，以像素为单位。
     */
    protected _textHeight: number = 0;
    protected _realFont: string;
    protected _bitmapFont: BitmapFont;
    protected _scrollPos: Point | null;
    protected _bgDrawCmd: DrawRectCmd;
    protected _html: boolean = false;
    protected _ubb: boolean = false;
    protected _lines: Array<ITextLine>;
    protected _elements: Array<HtmlElement>
    protected _objContainer: Sprite;
    protected _maxWidth: number = 0;
    protected _hideText: boolean = false;
    private _updatingLayout: boolean;
    private _fontSizeScale: number;
    private _fontGlobalScale: number;

    /**
     * @internal
     * @en Whether to convert` \n `and `\t `in the string to functional characters.
     * @zh 是否将字符串中的`\n`,`\t`转换为实际功能的字符。
     */
    _parseEscapeChars: boolean;
    /**
     * An callback to translate the text.
     */
    _onTranslate: (text: string, options: any, role?: number) => string;


    private _fitContent: TextFitContent = 0;
    private _fitFlag: boolean;

    /**caochangli - 是否存在ubb-color标签 */
    private _existUBBColorTag:boolean;

    constructor() {
        super();

        this._renderType |= SpriteConst.TEXT;
        this._textStyle = new TextStyle();
        this._textStyle.fontSize = Config.defaultFontSize;
        this._text = "";
        this.font = "";
        this._elements = [];
        this._lines = [];
        this._padding = [0, 0, 0, 0];
        this._fontSizeScale = 1;
        this.graphics._useSpriteRect = true;

        this.padding.fill(2);
        this._onTranslate = Translations.translate;
    }

    /**
     * @en Destroy the text.
     * @param destroyChild Whether to destroy child nodes. Default is true.
     * @zh 销毁文本。
     * @param destroyChild 是否销毁子节点。默认为 true。
     */
    destroy(destroyChild: boolean = true): void {
        Text_recoverLines(this._lines);
        HtmlElement.returnToPool(this._elements);

        if (this._bgDrawCmd) //去除lock标志，让它在destroy时被回收
            (this._bgDrawCmd as IGraphicsCmd).lock = false;

        super.destroy();

        //回收加载的BitmapFont资源
        if (this._assetGroup)
        {
            AssetGroup.Release(this._assetGroup);
            this._assetGroup = null;
        }
    }

    /**
     * @ignore
     */
    protected measureWidth(): number {
        this.typeset();
        return this._textWidth;
    }

    /**
     * @ignore
     */
    protected measureHeight(): number {
        this.typeset();
        return this._textHeight;
    }

    /**
     * @ignore
     */
    protected _transChanged(kind: TransformKind) {
        super._transChanged(kind);

        if ((kind & TransformKind.Size) != 0) {
            if (this._scrollRect != null) {
                this._updateScrollRect();
            }

            if (!this._updatingLayout)
                this.markChanged();
            else
                this.drawBg();
        }
    }

    /**
     * @ignore
     */
    private _updateScrollRect(): void {
        let rect = this._scrollRect || new Rectangle();
        let rectWidth = this._isWidthSet ? this._width : this._textWidth;
        let rectHeight = this._isHeightSet ? this._height : this._textHeight;
        rect.setTo(0, 0, rectWidth, rectHeight);
        this.scrollRect = rect;
    }

    /**
     * @en The width of the text in pixels.
     * @zh 文本的宽度，以像素为单位。
     */
    get textWidth(): number {
        this.typeset();
        return this._textWidth;
    }

    /**
     * @en The height of the text in pixels.
     * @zh 文本的高度，以像素为单位。
     */
    get textHeight(): number {
        this.typeset();
        return this._textHeight;
    }

    /**
     * @en The current content string of the text.
     * @zh 当前文本的内容字符串。
     */
    get text(): string {
        return this._text;
    }

    set text(value: string) {
        if (value == null)
            value = "";
        else if (typeof (value) !== "string")
            value = '' + value;

        if (!this.ignoreLang && Text.langPacks)
            value = Text.langPacks[value] || value;

        if (this._text != value) {
            this._text = value;
            this._existUBBColorTag = false;//caochangli
            this.markChanged();
            this.event(Event.CHANGE);
        }
    }

    /**
     * @deprecated 
     * @param text 文本
     */
    // changeText(text: string): void {
    //     this.text = text;
    // }

    /**
     * @en The font name of the text, represented as a string.
     * The default value is "Arial", which can be set through Config.defaultFont.
     * If the runtime system cannot find the specified font, it will render the text with the system default font, which may cause display anomalies. (Usually, it displays normally on computers, but may display abnormally on some mobile devices due to the lack of the set font.)
     * @zh 文本的字体名称，以字符串形式表示。
     * 默认值为："Arial"，可以通过Config.defaultFont设置默认字体。
     * 如果运行时系统找不到设定的字体，则用系统默认的字体渲染文字，从而导致显示异常。(通常电脑上显示正常，在一些移动端因缺少设置的字体而显示异常)。
     */
    get font(): string {
        return this._textStyle.font;
    }

    set font(value: string) {
        this._textStyle.font = value;
        if (!value) {
            value = Config.defaultFont;
            if (!value)
                value = "Arial";
        }

        // caochangli
        if (this._realFont == value)
            return;
        // caochangli
        if (this._assetGroup)
            this._assetGroup.CancelAllAssets(true);

        this._realFont = value;
        this._bitmapFont = Text._bitmapFonts[value];

        if (this._bitmapFont) {
            if (this._text)
                this.markChanged();
        }
        else if (value && (Utils.getFileExtension(value) || value.startsWith("res://"))) {
            let fontObj = ILaya.loader.getRes(value);
            if (!fontObj || fontObj.obsolute) {
                this._realFont = "Arial";
                let t = this._textStyle.font;

                // ILaya.loader.load(value).then(fontObj => {
                //     if (this._textStyle.font != t || !fontObj)
                //         return;

                //     if (fontObj instanceof BitmapFont)
                //         this._bitmapFont = fontObj;
                //     else 
                //         this._realFont = fontObj.family;
                //     if (this._text)
                //         this.markChanged();
                // });
                
                // caochangli - 字体加载走业务层资源管理器(主要为了解决BitmapFont资源回收)
                // ttf嵌入字也会走这里 - 嵌入字计数加上也没关系(嵌入字本身就不需要回收)，且已在clearRes删除接口中过滤了
                // 预览模式 - 将uuid转成url
                if (LayaEnv.isPreview)
                {
                    AssetDb.inst.uuidToUrl(value,(uuid:string,url:string)=>{
                        if (!this.destroyed && value && value == uuid)
                            this._loadFont(url,t);
                    });
                }
                else
                    this._loadFont(value,t);
            }
            else {
                if (fontObj instanceof BitmapFont)
                    this._bitmapFont = fontObj;
                else
                    this._realFont = fontObj.family;
                if (this._text)
                    this.markChanged();
            }
        }
        else {
            this._realFont = (Browser.onIPhone ? (Config.fontFamilyMap[value] || value) : value);
            if (this._text)
                this.markChanged();
        }
    }

    //caochangli - 走业务层资源管理器
    private _assetGroup:IAssetGroup;
    private _loadFont(url:string,styleFont:string) {
        if (!this._assetGroup)
            this._assetGroup = AssetGroup.Get();
        this._assetGroup.Load(url,null,this,(url:string,fontObj:any)=>{
            if (this._textStyle.font != styleFont || !fontObj)
                return;

            if (fontObj instanceof BitmapFont)
                this._bitmapFont = fontObj;
            else 
                this._realFont = fontObj.family;
            if (this._text)
                this.markChanged();
        });
    }


    /**
     * @en The actual font name used for rendering.
     * @zh 实际用于渲染的字体名称。
     */
    // get realFont() {
    //     return this._realFont;
    // }

    /**
     * @en Specifies the font size of the text in pixels.
     * The default is 20 pixels, which can be set through Config.defaultFontSize.
     * @zh 指定文本的字体大小（以像素为单位）。
     * 默认为20像素，可以通过 Config.defaultFontSize 设置默认大小。
     */
    get fontSize(): number {
        return this._textStyle.fontSize;
    }

    set fontSize(value: number) {
        if (this._textStyle.fontSize != value) {
            this._textStyle.fontSize = value;
            this.markChanged();
        }
    }

    /**
     * @en Represents the color value of the text. The default color can be set through Text.defaultColor.
     * The default value is black.
     * @zh 表示文本的颜色值。可以通过 Text.defaultColor 设置默认颜色。
     * 默认值为黑色。
     */
    get color(): string {
        return this._textStyle.color;
    }

    set color(value: string) {
        if (this._textStyle.color != value) {
            this._textStyle.color = value;
            //如果仅仅更新颜色，无需重新排版 - caochangli：仅勾选ubb但没ubb标签或ubb标签中没color标签按常规文本处理
            if (!this._isChanged && !this._html && (!this._ubb || !this._existUBBColorTag))
                this._graphics.replaceTextColor(this._textStyle.color);
            else
                this.markChanged();
        }
    }

    /**
     * @en Specifies whether the text is bold.
     * The default value is false, which means bold is not used. If the value is true, the text is bold.
     * @zh 指定文本是否为粗体字。
     * 默认值为 false，这意味着不使用粗体字。如果值为 true，则文本为粗体字。
     */
    get bold(): boolean {
        return this._textStyle.bold;
    }

    set bold(value: boolean) {
        if (this._textStyle.bold != value) {
            this._textStyle.bold = value;
            this.markChanged();
        }
    }

    /**
     * @en Indicates whether the text using this text format is italic.
     * The default value is false, which means italic is not used. If the value is true, the text is italic.
     * @zh 表示使用此文本格式的文本是否为斜体。
     * 默认值为 false，这意味着不使用斜体。如果值为 true，则文本为斜体。
     */
    get italic(): boolean {
        return this._textStyle.italic;
    }

    set italic(value: boolean) {
        if (this._textStyle.italic != value) {
            this._textStyle.italic = value;
            this.markChanged();
        }
    }

    /**
     * @en Represents the horizontal alignment of the text.
     * Possible values:
     * - "left": Left-aligned.
     * - "center": Center-aligned.
     * - "right": Right-aligned.
     * @zh 表示文本的水平显示方式。
     * 取值：
     * - "left"： 居左对齐显示。
     * - "center"： 居中对齐显示。
     * - "right"： 居右对齐显示。
     */
    get align(): string {
        return this._textStyle.align;
    }

    set align(value: string) {
        if (this._textStyle.align != value) {
            this._textStyle.align = value;
            this.markChanged();
        }
    }

    /**
     * @en Represents the vertical alignment of the text.
     * Possible values:
     * - "top": Top-aligned.
     * - "middle": Middle-aligned.
     * - "bottom": Bottom-aligned.
     * @zh 表示文本的垂直显示方式。
     * 取值：
     * - "top"： 居顶部对齐显示。
     * - "middle"： 居中对齐显示。
     * - "bottom"： 居底部对齐显示。
     */
    get valign(): string {
        return this._textStyle.valign;
    }

    set valign(value: string) {
        if (this._textStyle.valign != value) {
            this._textStyle.valign = value;
            this.markChanged();
        }
    }

    /**
     * @en Alignment of images and text in mixed content. Possible values are top, middle, bottom.
     * @zh 图文混排时图片和文字的对齐方式。可选值是 top, middle, bottom。
     */
    get alignItems(): string {
        return this._textStyle.alignItems;
    }

    set alignItems(value: string) {
        if (this._textStyle.alignItems != value) {
            this._textStyle.alignItems = value;
            this.markChanged();
        }
    }

    /**
     * @en Indicates whether the text automatically wraps, default is false.
     * If true, the text will automatically wrap; otherwise, it will not.
     * @zh 表示文本是否自动换行，默认为 false。
     * 若值为 true，则自动换行；否则不自动换行。
     */
    get wordWrap(): boolean {
        return this._wordWrap;
    }

    set wordWrap(value: boolean) {
        if (this._wordWrap != value) {
            this._wordWrap = value;
            this.markChanged();
        }
    }

    /**
     * @en Vertical line spacing in pixels.
     * @zh 垂直行间距（以像素为单位）。
     */
    get leading(): number {
        return this._textStyle.leading;
    }

    set leading(value: number) {
        if (this._textStyle.leading != value) {
            this._textStyle.leading = value;
            this.markChanged();
        }
    }

    /**
     * @en Margin information.
     * Data format: [top margin, right margin, bottom margin, left margin] (margins in pixels).
     * @zh 边距信息。
     * 数据格式：[上边距，右边距，下边距，左边距]（边距以像素为单位）。
     */
    get padding(): number[] {
        return this._padding;
    }

    set padding(value: number[] | string) {
        if (typeof (value) == 'string') {
            let arr = value.split(",");
            this._padding.length = 0;
            for (let i = 0; i < 4; i++) {
                let v = parseFloat(arr[i]);
                if (isNaN(v))
                    v = 0;
                this._padding.push(v);
            }
        }
        else
            this._padding = value;
        this.markChanged();
    }

    /**
     * @en Text background color, represented as a string.
     * @zh 文本背景颜色，以字符串表示。
     */
    // get bgColor(): string {
    //     return this._bgColor;
    // }

    // set bgColor(value: string) {
    //     this._bgColor = value;
    //     this.drawBg();
    // }

    /**
     * @en Text border background color, represented as a string.
     * @zh 文本边框背景颜色，以字符串表示。
     */
    // get borderColor(): string {
    //     return this._borderColor;
    // }

    // set borderColor(value: string) {
    //     this._borderColor = value;
    //     this.drawBg();
    // }

    /**
     * @en Stroke width in pixels.
     * The default value is 0, which means no stroke.
     * @zh 描边宽度（以像素为单位）。
     * 默认值0，表示不描边。
     */
    get stroke(): number {
        return this._textStyle.stroke;
    }

    set stroke(value: number) {
        if (this._textStyle.stroke != value) {
            this._textStyle.stroke = value;
            this.markChanged();
        }
    }

    /**
     * @en Stroke color, represented as a string.
     * The default value is "#000000" (black).
     * @zh 描边颜色，以字符串表示。
     * 默认值为 "#000000"（黑色）。
     */
    get strokeColor(): string {
        return this._textStyle.strokeColor;
    }

    set strokeColor(value: string) {
        if (this._textStyle.strokeColor != value) {
            this._textStyle.strokeColor = value;
            this.markChanged();
        }
    }

    /**
     * @en Specifies the behavior when text exceeds the text area.
     * Values: visible, hidden, scroll, shrink, ellipsis.
     * Effects:
     * - visible: All text is visible regardless of text width and height constraints.
     * - hidden: Text exceeding width and height will be clipped, best for performance.
     * - scroll: Parts exceeding width and height are hidden, can be controlled by scrolling.
     * - shrink: Text size automatically adjusts to fit within the width and height.
     * - ellipsis: When text exceeds width and height, last few characters are replaced with ellipsis.
     * @zh 指定文本超出文本域后的行为。
     * 值为：可见visible、隐藏hidden、滚动scroll、自动收缩shrink、显示省略号ellipsis。
     * 作用：
     * - 可见：文本不受文本宽高约束全部可见。
     * - 隐藏：超过文本宽高就会被裁切掉，性能最好。
     * - 滚动：超出宽高的部分被隐藏，可以通过划动控制显示在宽高内区域。
     * - 自动收缩：文本会跟随宽高的大小而自动调整文本的大小，始终全部显示在文本宽高内。
     * - 显示省略号：当文本超出宽高后，未尾的几位字符会替换为省略号，表示当前文本还有未显示的内容。
     */
    get overflow(): string {
        return this._overflow;
    }

    set overflow(value: string) {
        if (this._overflow != value) {
            this._overflow = value;
            if (value !== Text.VISIBLE) {
                this._updateScrollRect();
            }
            else
                this.scrollRect = null;

            // caochangli - 修改此属性时需要重新布局
            if (this._text)
                this.markChanged();
        }
    }

    /**
     * @en Whether to display underline.
     * @zh 是否显示下划线。
     */
    get underline(): boolean {
        return this._textStyle.underline;
    }

    set underline(value: boolean) {
        if (this._textStyle.underline != value) {
            this._textStyle.underline = value;
            this.markChanged();
        }
    }

    /**
     * @en The color of the underline. If null, it uses the font color.
     * @zh 下划线的颜色。如果为null，则使用字体颜色。
     */
    get underlineColor(): string {
        return this._textStyle.underlineColor;
    }

    set underlineColor(value: string) {
        if (this._textStyle.underlineColor != value) {
            this._textStyle.underlineColor = value;
            this.markChanged();
        }
    }

    /**
     * @en Whether to display strikethrough.
     * @zh 是否显示删除线。
     */
    get strikethrough(): boolean {
        return this._textStyle.strikethrough;
    }

    set strikethrough(value: boolean) {
        if (this._textStyle.strikethrough != value) {
            this._textStyle.strikethrough = value;
            this.markChanged();
        }
    }

    /**
     * @en The color of the strikethrough. If null, it uses the font color.
     * @zh 下划线的颜色，为null则使用字体颜色。
     */
    get strikethroughColor(): string {
        return this._textStyle.strikethroughColor;
    }

    set strikethroughColor(value: string) {
        if (this._textStyle.strikethroughColor != value) {
            this._textStyle.strikethroughColor = value;
            this.markChanged();
        }
    }


    /**
     * @en Whether single character rendering is enabled. Enable this if the text content changes frequently, such as an increasing number, to prevent inefficient use of cache.
     * @zh 是否启用单个字符渲染。如果Text的内容一直改变，例如是一个增加的数字，就设置这个，防止无效占用缓存 
     */
    get singleCharRender(): boolean {
        return this._singleCharRender;
    }

    set singleCharRender(value: boolean) {
        if (this._singleCharRender !== value) {
            this._singleCharRender = value;
            this.markChanged();
        }
    }

    /**
     * @en Whether rich text is enabled, supporting HTML syntax.
     * @zh 是否启用富文本，支持HTML语法。
     */
    get html(): boolean {
        return this._html;
    }

    set html(value: boolean) {
        if (this._html != value) {
            this._html = value;
            this.markChanged();
        }
    }

    /**
     * @en Whether UBB syntax parsing is enabled for text.
     * @zh 是否启用UBB语法解析文本。
     */
    get ubb(): boolean {
        return this._ubb;
    }

    set ubb(value: boolean) {
        if (this._ubb != value) {
            this._ubb = value;
            this.markChanged();
        }
    }

    /**
     * @en The maximum width allowed for text. When text reaches this width, it will automatically wrap. Set to 0 to disable this limit.
     * @zh 文本允许的最大宽度。当文本达到这个宽度时，将自动换行。设置为0则此限制不生效。
     */
    get maxWidth(): number {
        return this._maxWidth;
    }

    set maxWidth(value: number) {
        if (this._maxWidth != value) {
            this._maxWidth = value;
            this.markChanged();
        }
    }

    /**
     * @en Rich text HTML mode options.
     * @zh 富文本HTML模式选项。
     */
    // get htmlParseOptions(): HtmlParseOptions {
    //     return this._htmlParseOptions;
    // }

    // set htmlParseOptions(value: HtmlParseOptions) {
    //     this._htmlParseOptions = value;
    // }

    /**
     * @en Text Template
     * @zh 文本模板
     */
    public get templateVars(): Record<string, any> {
        return this._templateVars;
    }

    public set templateVars(value: Record<string, any> | boolean) {
        if (!this._templateVars && !value)
            return;

        if (value === true)
            this._templateVars = {};
        else if (value === false)
            this._templateVars = null;
        else
            this._templateVars = value;
        this.markChanged();
    }

    /**
     * @en Set the value of a template variable.
     * @param name The name of the template variable.
     * @param value The value to set.
     * @returns The current Text instance.
     * @zh 设置模板值。
     * @param name 模板名 
     * @param value 值
     * @returns 当前 Text 实例。
     */
    public setVar(name: string, value: any): this {
        if (!this._templateVars)
            this._templateVars = {};
        this._templateVars[name] = value;
        this.markChanged();

        return this;
    }

    /**
     * @en The horizontal scroll amount.
     * Even if a value outside the scroll range is set, it will be automatically limited to the maximum possible value.
     * @zh 横向滚动量。
     * 即使设置超出滚动范围的值，也会被自动限制在可能的最大值处。
     */
    // get scrollX(): number {
    //     if (!this._scrollPos) return 0;
    //     return this._scrollPos.x;
    // }

    // set scrollX(value: number) {
    //     this.typeset();
    //     if (!this._scrollPos) return;

    //     let maxScrollX = this.maxScrollX;
    //     value = value < 0 ? 0 : value;
    //     value = value > maxScrollX ? maxScrollX : value;

    //     this._scrollPos.x = value;
    //     this.renderText();
    // }

    /**
     * @en The vertical scroll amount (in pixels).
     * Even if a value outside the scroll range is set, it will be automatically limited to the maximum possible value.
     * @zh 纵向滚动量（以像素为单位）。
     * 即使设置超出滚动范围的值，也会被自动限制在可能的最大值处。
     */
    // get scrollY(): number {
    //     if (!this._scrollPos) return 0;
    //     return this._scrollPos.y;
    // }

    // set scrollY(value: number) {
    //     this.typeset();
    //     if (!this._scrollPos) return;

    //     let maxScrollY = this.maxScrollY;
    //     value = value < 0 ? 0 : value;
    //     value = value > maxScrollY ? maxScrollY : value;

    //     this._scrollPos.y = value;
    //     this.renderText();
    // }

    /**
     * @en The maximum horizontal scrollable value.
     * @zh 横向可滚动的最大值。
     */
    get maxScrollX(): number {
        let r = this.textWidth - this._width;
        return r < 0 ? 0 : r;
    }

    /**
     * @en The maximum vertical scrollable value.
     * @zh 纵向可滚动的最大值。
     */
    get maxScrollY(): number {
        let r = this.textHeight - this._height;
        return r < 0 ? 0 : r;
    }

    /**
     * @en The text line information.
     * @zh 文字行信息。
     */
    get lines(): ReadonlyArray<ITextLine> {
        this.typeset();
        return this._lines;
    }

    /**
     * @internal
     */
    protected markChanged() {
        if (!this._isChanged) {
            this._isChanged = true;
            ILaya.systemTimer.callLater(this, this._typeset);
        }
    }

    /**
     * @en Typeset the text.
     * @param force Whether to force typesetting.
     * @zh 排版文本。
     * @param force 是否强制排版。
     */
    typeset(force?: boolean) {
        (this._isChanged || force) && ILaya.systemTimer.runCallLater(this, this._typeset, true);
    }

    /**
     * @en Refresh the layout with a delay.
     * @zh 延迟刷新排版。
     */
    refreshLayout() {
        ILaya.systemTimer.callLater(this, this.doLayout);
    }

    /**
     * @en The object container.
     * @zh 对象容器。
     */
    get objContainer(): Sprite {
        if (!this._objContainer) {
            this._objContainer = new Sprite();
            this._objContainer.hideFlags |= HideFlags.HideAndDontSave;
            this.addChild(this._objContainer);
        }
        return this._objContainer;
    }

    /**
     * @en Hide the text. This is commonly used for input text field when it is focused.
     * @zh 隐藏文本。常用于输入文本框处于焦点时。
     */
    // hideText(value: boolean) {
    //     this._hideText = value;
    //     if (value) {
    //         this.graphics.clear(true, this._bgDrawCmd);
    //     }
    //     else {
    //         this.markChanged();
    //         this.typeset();
    //     }
    // }

    /**
     * 排版文本。
     * 进行宽高计算，渲染、重绘文本。
     */
    protected _typeset(): void {
        this._isChanged = false;
        if (this._hideText || this._destroyed)
            return;

        HtmlElement.returnToPool(this._elements);
        if (this._objContainer)
            this._objContainer.removeChildren();

        let text = this._text;

        if (this._onTranslate)
            text = this._onTranslate(text, this._templateVars);

        let isPrompt: boolean;
        if (!text && this._prompt) {
            text = this._prompt;
            if (this._onTranslate)
                text = this._onTranslate(text, null, 1);
            isPrompt = true;
        }

        if (!text) {
            this.graphics.clear(true, this._bgDrawCmd);

            this._textWidth = this._textHeight = 0;
            this._scrollPos = null;
            if (this._onPostLayout) {
                this._updatingLayout = true;
                this._onPostLayout();
                this._updatingLayout = false;
            }
            return;
        }

        let html = this._html;
        text = text.replace(Text_normalizeCR, "\n");
        if (this._parseEscapeChars)
            text = text.replace(Text_escapeCharsPattern, Text_getReplaceStr);
        if (!isPrompt && this._templateVars)
            text = Utils.parseTemplate(text, this._templateVars);

        if (this._ubb) {
            text = UBBParser.defaultParser.parse(text);
            // caochangli - 存在ubb标签，才转换为html处理
            if (UBBParser.defaultParser.existUBBTag) {
                this._existUBBColorTag = UBBParser.defaultParser.existColorTag;
                html = true;
            }
        }
        if (!isPrompt && this._asPassword)
            text = Text._passwordChar.repeat(text.length);

        let saveColor: string;
        if (isPrompt) {
            saveColor = this._textStyle.color;
            this._textStyle.color = this._promptColor;
        }
        if (html)
            HtmlParser.defaultParser.parse(text, this._textStyle, this._elements, this._htmlParseOptions);
        else {
            let ele = HtmlElement.getFromPool(HtmlElementType.Text);
            Object.assign(ele.style, this._textStyle);
            ele.text = text;
            this._elements.push(ele);
        }
        if (isPrompt)
            this._textStyle.color = saveColor;

        this.doLayout();
    }

    /**
     * @en Analyze text wrapping.
     * @zh 分析文本换行。
     */
    protected doLayout(): void {
        if (this._destroyed)
            return;

        this._updatingLayout = true;
        this._fontSizeScale = 1;
//#region caochangli - 注释原始闭包写法
        // let wordWrap = this._wordWrap || this._overflow == Text.ELLIPSIS;
        // let noBreakWord = this._wordWrap;
        // let padding = this._padding;
        // let rectWidth: number;
        // if (this._isWidthSet)
        //     rectWidth = this._width - padding[3] - padding[1];
        // else
        //     rectWidth = Number.MAX_VALUE;
        // if (this._maxWidth > 0) {
        //     let m = this._maxWidth - padding[3] - padding[1];
        //     if (!wordWrap || m < rectWidth)
        //         rectWidth = m;
        //     wordWrap = true;
        // }
        // let rectHeight = this._isHeightSet ? (this._height - padding[0] - padding[2]) : Number.MAX_VALUE;
        // let alignItems = this._textStyle.alignItems == "middle" ? 1 : (this._textStyle.alignItems == "bottom" ? 2 : 0);

        // let lineX: number, lineY: number;
        // let curLine: ITextLine;
        // let lastCmd: ITextCmd;
        // let charWidth: number, charHeight: number;
        // let fontSize: number;
        // let bfont = this._bitmapFont;
        // let ctxFont: string;
        // let textRender = Render2DProcessor.runner._textRender;

        // let getTextWidth = (text: string) => {
        //     if (bfont)
        //         return bfont.getTextWidth(text, fontSize);
        //     else {
        //         let ret = Browser.context.measureText(text);
        //         return ret ? ret.width : 100;
        //     }
        // };

        // let getTextWidth2 = (text: string, font: string, fontSize: number) => {
        //     if (bfont) {
        //         return bfont.getTextWidth(text, fontSize);
        //     }
        //     else {
        //         let t = Browser.context.font;
        //         Browser.context.font = font;
        //         let ret = Browser.context.measureText(text);
        //         Browser.context.font = t;
        //         return ret ? ret.width : 100;
        //     }
        // };

        // let buildLines = (text: string, style: TextStyle) => {
        //     fontSize = Math.floor(style.fontSize * this._fontSizeScale);
        //     if (fontSize == 0)
        //         fontSize = 1;

        //     if (bfont) {
        //         charWidth = bfont.getMaxWidth(fontSize);
        //         charHeight = bfont.getMaxHeight(fontSize);
        //     } else {
        //         Browser.context.font = ctxFont = (style.bold ? "bold " : "") + fontSize + "px " + this._realFont;
        //         charWidth = fontSize;
        //         charHeight = textRender.getFontHeight(this._realFont, fontSize, style.bold);
        //     }

        //     let lines = text.split("\n");
        //     if (wordWrap) {
        //         for (let i = 0, n = lines.length; i < n; i++) {
        //             let line = lines[i];
        //             if (line.length > 0)
        //                 wrapText(line, style);
        //             if (i != n - 1) {
        //                 addLine();
        //             }
        //         }
        //     }
        //     else {
        //         for (let i = 0, n = lines.length; i < n; i++) {
        //             let line = lines[i];
        //             if (line.length > 0)
        //                 addCmd(line, style, null);
        //             if (i != n - 1) {
        //                 addLine();
        //             }
        //         }
        //     }
        // };

        // let addCmd = (target: string | IHtmlObject, style: TextStyle, width?: number) => {
        //     let cmd: ITextCmd = cmdPool.length > 0 ? cmdPool.pop() : <any>{};
        //     cmd.x = lineX;
        //     cmd.y = lineY;
        //     if (typeof (target) === "string") {
        //         if (!width)
        //             width = getTextWidth(target);
        //         cmd.text = target;
        //         cmd.ctxFont = ctxFont;
        //         cmd.fontSize = fontSize;
        //         cmd.width = width;
        //         cmd.height = charHeight;
        //     }
        //     else {
        //         cmd.obj = target;
        //         cmd.width = target.width;
        //         cmd.height = target.height;
        //         if (target.width > 0) {
        //             cmd.x++;
        //             cmd.width += 2;
        //         }
        //     }
        //     cmd.style = style;
        //     cmd.linkEnd = false;
        //     cmd.next = null;
        //     cmd.prev = lastCmd;
        //     lineX += Math.round(cmd.width);

        //     if (lastCmd)
        //         lastCmd.next = cmd;
        //     else
        //         curLine.cmd = cmd;
        //     lastCmd = cmd;
        // };

        // let moveCmds = (cmd: ITextCmd) => {
        //     while (cmd.linkEnd && cmd.next) { //跳过空链接的结束符
        //         cmd = cmd.next;
        //     }
        //     if (!cmd)
        //         return;

        //     cmd.prev.next = null;
        //     while (cmd) {
        //         let next = cmd.next;
        //         cmd.x = lineX;
        //         cmd.y = lineY;
        //         cmd.next = null;
        //         cmd.prev = lastCmd;
        //         lineX += Math.round(cmd.width);

        //         if (lastCmd)
        //             lastCmd.next = cmd;
        //         else
        //             curLine.cmd = cmd;
        //         lastCmd = cmd;
        //         cmd = next;
        //     }
        // };

        // let splitCmd = (cmd: ITextCmd, pos: number) => {
        //     let ccode = cmd.text.charCodeAt(pos);
        //     if (isLowSurrogate(ccode))
        //         pos--;
        //     if (pos == 0)
        //         return false;

        //     let str = cmd.text.substring(pos);

        //     cmd.text = cmd.text.substring(0, pos);
        //     cmd.width = getTextWidth2(cmd.text, cmd.ctxFont, cmd.fontSize);

        //     let cmd2: ITextCmd = cmdPool.length > 0 ? cmdPool.pop() : <any>{};
        //     cmd2.text = str;
        //     cmd2.style = cmd.style;
        //     cmd2.ctxFont = cmd.ctxFont;
        //     cmd2.fontSize = cmd.fontSize;
        //     cmd2.width = getTextWidth2(str, cmd.ctxFont, cmd.fontSize);
        //     cmd2.height = cmd.height;

        //     cmd2.next = cmd.next;
        //     cmd2.prev = cmd;
        //     cmd.next = cmd2;

        //     return true;
        // };

        // let addLine = (last?: boolean) => {
        //     lineX = 0;
        //     if (curLine) {
        //         //计算行高
        //         let lineHeight = 0;
        //         let lineWidth = 0;
        //         let cmd = curLine.cmd;
        //         while (cmd) {
        //             if (cmd.height > lineHeight) lineHeight = cmd.height;
        //             lineWidth += cmd.width;
        //             cmd = cmd.next;
        //         }

        //         //调整元素y位置
        //         cmd = curLine.cmd;
        //         while (cmd) {
        //             if (alignItems == 1)
        //                 cmd.y = Math.floor((lineHeight - cmd.height) * 0.5);
        //             else if (alignItems == 2)
        //                 cmd.y = Math.floor((lineHeight - cmd.height));
        //             else
        //                 cmd.y = 0;
        //             cmd = cmd.next;
        //         }

        //         if (lineHeight == 0)
        //             lineHeight = charHeight;
        //         lineHeight++; //预留一个像素用来放下划线

        //         curLine.height = lineHeight;
        //         curLine.width = Math.round(lineWidth);

        //         lineY += curLine.height + Math.floor(this._textStyle.leading * this._fontSizeScale);
        //     }

        //     if (last)
        //         return null;

        //     curLine = linePool.length > 0 ? linePool.pop() : <any>{};
        //     curLine.x = 0;
        //     curLine.y = lineY;
        //     this._lines.push(curLine);
        //     lastCmd = null;

        //     return curLine;
        // };

        // let wrapText = (text: string, style: TextStyle) => {
        //     let remainWidth = Math.max(0, rectWidth - lineX);

        //     let tw = getTextWidth(text);
        //     //优化1，如果一行小于宽度，则直接跳过遍历
        //     if (tw <= remainWidth) {
        //         addCmd(text, style, tw);
        //         return;
        //     }

        //     let maybeIndex = 0;
        //     let wordWidth = 0;
        //     let startIndex = 0;
        //     let isPunc: boolean;
        //     let testResult: RegExpExecArray;

        //     let isEmoji = emojiTest.test(text);
        //     if (!bfont && !isEmoji) {
        //         //优化2，预算第几个字符会超出，减少遍历及字符宽度度量
        //         maybeIndex = Math.floor(remainWidth / charWidth);
        //         if (maybeIndex != 0)
        //             wordWidth = getTextWidth(text.substring(0, maybeIndex));
        //     }

        //     let len = text.length;
        //     for (let j = maybeIndex; j < len; j++) {
        //         let cc = text.charAt(j);
        //         let ccode = cc.charCodeAt(0);

        //         if (isEmoji && isHighSurrogate(ccode) && j + 1 < len)
        //             cc += text.charAt(j + 1);

        //         tw = getTextWidth(cc);
        //         wordWidth += tw;

        //         if (wordWidth <= remainWidth || j === startIndex && lineX === 0) { //一行如果连一个字符都放不下，强制放一个
        //             if (cc.length > 1) //emoji
        //                 j++;
        //             continue;
        //         }

        //         let part = text.substring(startIndex, j);
        //         wordWidth -= tw;

        //         //如果换行位置是字母或标点符号，需要向前查找单词的边界，避免单词被拆开
        //         //如果是标点符号，还需要保证不在行首
        //         if (noBreakWord && ((ccode >= 65 && ccode <= 90) || (ccode >= 97 && ccode <= 122) //英文字符
        //             || (ccode >= 48 && ccode <= 57) // 0-9
        //             || (isPunc = punctuationChars.includes(ccode)))) {
        //             let wb = part.length > 0 ? ((testResult = wordBoundaryTest.exec(part)) ? testResult.index : null) : 0;
        //             if (wb > 0) { //边界在文本中间
        //                 if (wb > part.length - maxWordLength) { //限制字符个数，超过的不看做一个单词
        //                     j = startIndex + wb;
        //                     part = text.substring(startIndex, j);
        //                     wordWidth = null; //part指向的字符串已改变，wordWidth无效
        //                     tw = null; //j指向的字符已改变，tw无效
        //                 }
        //                 //else 做默认处理即可
        //             }
        //             else if (wb != null && lastCmd != null) { //未找到边界，还需要向前面的元素查找
        //                 let cmd = lastCmd;
        //                 let totalLen = part.length;
        //                 let newLine = false;
        //                 while (cmd) {
        //                     if (cmd.width > 0) {
        //                         if (cmd.obj != null)
        //                             break;

        //                         testResult = wordBoundaryTest.exec(cmd.text);
        //                         let textLen = cmd.text.length;
        //                         if (testResult == null) { //边界就在文本的末尾
        //                             addLine();
        //                             if (isPunc && totalLen == 0) { //再次检查标点符号不能在行首
        //                                 if (splitCmd(cmd, textLen - 1)) //将最后一个字符移到下一行
        //                                     moveCmds(cmd.next);
        //                                 else if (cmd.x > 0) //如果命令不在行首，整个命令移到下一行
        //                                     moveCmds(cmd);
        //                             }
        //                             else if (cmd.next != null)
        //                                 moveCmds(cmd.next);

        //                             newLine = true;
        //                             break;
        //                         }
        //                         else if (testResult.index > 0) {
        //                             if (testResult.index > textLen - (maxWordLength - totalLen)) { //限制字符个数，超过的不看做一个单词
        //                                 addLine();
        //                                 splitCmd(cmd, testResult.index);
        //                                 moveCmds(cmd.next);

        //                                 newLine = true;
        //                             }
        //                             break;
        //                         }
        //                         else {
        //                             totalLen += textLen; // 继续向前
        //                             if (totalLen >= maxWordLength)
        //                                 break;
        //                         }
        //                     }
        //                     cmd = cmd.prev;
        //                 }

        //                 if (newLine) {
        //                     remainWidth = rectWidth - lineX;
        //                     if (wordWidth + tw < remainWidth) {
        //                         wordWidth += tw;
        //                         continue; //然后继续下一字符即可
        //                     }
        //                     //else j对应的字符也放不下了，那么和默认处理逻辑是一样的
        //                 }
        //             }
        //             else { //边界就在文本的末尾
        //                 if (isPunc) { //标点符号不允许在行首
        //                     let b = (isEmoji && j >= 1 && isLowSurrogate(text.charCodeAt(j - 1))) ? 2 : 1;
        //                     if (j - b > startIndex || lineX > 0) { //这里有个边界判断，如果只剩一个字符了，并且在行头，就不能移动了
        //                         j -= b; //回退一个字符
        //                         part = text.substring(startIndex, j);
        //                         wordWidth = null; //part指向的字符串已改变，wordWidth无效
        //                         tw = null; //j指向的字符已改变，tw无效
        //                     }
        //                 }
        //                 //else 做默认处理即可
        //             }
        //         }

        //         if (part.length > 0)
        //             addCmd(part, style, wordWidth);
        //         addLine();

        //         startIndex = j;
        //         remainWidth = rectWidth;
        //         wordWidth = null;

        //         if (maybeIndex > 1)
        //             j += maybeIndex - 1;
        //         else if (tw != null) { //一个优化，如果是单字符遍历，而且j还是指向当前字符，那么直接用tw就行
        //             wordWidth = tw;
        //             if (cc.length > 1)
        //                 j++;
        //         }
        //         else if (isEmoji && isHighSurrogate(text.charCodeAt(j)))
        //             j++;

        //         if (wordWidth == null && j < len - 1)
        //             wordWidth = getTextWidth(text.substring(startIndex, j + 1));
        //     }

        //     addCmd(text.substring(startIndex, len), style);
        // };

        // let calcTextSize = () => {
        //     let nw: number = 0, nh: number = 0;
        //     for (let line of this._lines) {
        //         if (line.width > nw)
        //             nw = line.width;
        //     }
        //     if (nw > 0)
        //         nw += padding[1] + padding[3];
        //     this._textWidth = nw;

        //     let lastLine = this._lines[this._lines.length - 1];
        //     if (lastLine)
        //         nh = lastLine.y + lastLine.height;
        //     if (nh > 0)
        //         nh += padding[0] + padding[2];
        //     this._textHeight = nh;
        // };

        // let run = () => {
        //     lineX = lineY = charWidth = charHeight = 0;
        //     curLine = null;
        //     lastCmd = null;

        //     recoverLines(this._lines);
        //     addLine();

        //     let elements = this._elements;
        //     for (let i = 0, n = elements.length; i < n; i++) {
        //         let ele = elements[i];
        //         if (ele.type == HtmlElementType.Text) {
        //             buildLines(ele.text, ele.style);
        //         }
        //         else if (ele.type == HtmlElementType.LinkEnd) {
        //             if (lastCmd)
        //                 lastCmd.linkEnd = true;
        //         }
        //         else {
        //             let htmlObj = ele.obj;
        //             if (!htmlObj) {
        //                 let cls = HtmlParser.classMap[ele.type];
        //                 if (cls) {
        //                     htmlObj = Pool.createByClass(cls);
        //                     htmlObj.create(this, ele);
        //                     ele.obj = htmlObj;
        //                 }
        //             }

        //             if (htmlObj) {
        //                 if (wordWrap) {
        //                     let remainWidth = rectWidth - lineX;
        //                     if (htmlObj.width > 0 && remainWidth < htmlObj.width + 1) {
        //                         if (lineX > 0) { //如果已经是开始位置了，就算放不下也不换行
        //                             addLine();
        //                         }
        //                     }
        //                 }
        //                 addCmd(htmlObj, ele.style);
        //             }
        //         }
        //     }

        //     addLine(true);
        //     calcTextSize();
        // };

        // run();
//#endregion caochangli - 注释原始闭包写法


//#region caochangli - 采用独立方法优化写法
        this.layout_wordWrap = this._wordWrap || this._overflow == Text.ELLIPSIS;
        this.layout_padding = this._padding;
        if (this._isWidthSet)
            this.layout_rectWidth = this._width - this.layout_padding[3] - this.layout_padding[1];
        else
            this.layout_rectWidth = Number.MAX_VALUE;
        if (this._maxWidth > 0) {
            let m = this._maxWidth - this.layout_padding[3] - this.layout_padding[1];
            if (!this.layout_wordWrap || m < this.layout_rectWidth)
                this.layout_rectWidth = m;
            this.layout_wordWrap = true;
        }
        let rectHeight = this._isHeightSet ? (this._height - this.layout_padding[0] - this.layout_padding[2]) : Number.MAX_VALUE;
        this.layout_alignItems = this._textStyle.alignItems == "middle" ? 1 : (this._textStyle.alignItems == "bottom" ? 2 : 0);
        
        this.layout_fontSize = undefined;
        this.layout_ctxFont = undefined;
        this.layout_textRender = Render2DProcessor.runner._textRender;

        // 开始执行
        this.doLayoutRun();
        
        // 执行完毕 - 桥接方法和值给下面逻辑使用
        let padding = this.layout_padding;
        let rectWidth = this.layout_rectWidth;
        let charHeight = this.layout_charHeight;
        let curLine = this.layout_curLine;
        let fontSize = this.layout_fontSize;
        let ctxFont = this.layout_ctxFont;
//#endregion caochangli - 采用独立方法优化写法

        
        if (this._overflow == Text.SHRINK) {
            if (this._lines.length > 1 && this._textHeight > rectHeight) {
                //多行的情况，涉及到自动换行，得用二分法查找最合适的比例，会消耗多一点计算资源
                let low = 0;
                let high = this._textStyle.fontSize;

                //先尝试猜测一个比例
                this._fontSizeScale = Math.sqrt(rectHeight / this._textHeight);
                let cur = Math.floor(this._fontSizeScale * this._textStyle.fontSize);

                while (true) {
                    this.doLayoutRun();// run();

                    if (this._textWidth > rectWidth || this._textHeight > rectHeight)
                        high = cur;
                    else
                        low = cur;
                    if (high - low > 1 || high != low && cur == high) {
                        cur = low + (high - low) / 2;
                        this._fontSizeScale = cur / this._textStyle.fontSize;
                    }
                    else
                        break;
                }
            }
            else if (this._textWidth > rectWidth) {
                this._fontSizeScale = rectWidth / this._textWidth;

                this.doLayoutRun();// run();

                if (this._textWidth > rectWidth) //如果还超出，缩小一点再来一次
                {
                    let size = Math.floor(this._textStyle.fontSize * this._fontSizeScale);
                    size--;
                    this._fontSizeScale = size / this._textStyle.fontSize;

                    this.doLayoutRun();// run();
                }
            }
        }
        else if (this._overflow == Text.ELLIPSIS
            && (this._textWidth > rectWidth || this._textHeight > rectHeight || !this._wordWrap && this._lines.length > 1)) {
            //删掉超出的行
            let i: number;
            if (!this._wordWrap && this._lines.length > 1)
                i = 1;
            else {
                i = this._lines.findIndex(line => line.y + line.height > rectHeight);
                if (i === 0) i = 1;
            }
            let linesDeleted = false;
            if (i != -1 && this._lines.length > i) {
                Text_recoverLines(this._lines.splice(i, this._lines.length - i), true);
                linesDeleted = true;
            }

            //在最后一行加省略号
            curLine = this._lines[this._lines.length - 1];
            let cmd = curLine.cmd;
            let next: ITextCmd;
            let textCmd: ITextCmd;
            let done = false;
            while (cmd) {
                next = cmd.next;
                if (!cmd.obj)
                    textCmd = cmd;

                if (done) {
                    Text_cleanCmd(cmd, true);
                    Text_cmdPool.push(cmd);
                }
                else if ((!next && linesDeleted) || cmd.x + cmd.width > rectWidth - 10) { //10用来放省略号
                    if (cmd.obj) { //如果最后是个图片，那就删除图片，换成省略号
                        Text_cleanCmd(cmd, true);
                        cmd.text = Text_ellipsisStr;
                        if (textCmd) {
                            cmd.ctxFont = textCmd.ctxFont;
                            cmd.fontSize = textCmd.fontSize;
                            cmd.height = textCmd.height;
                            cmd.style = textCmd.style;
                        }
                        else {
                            cmd.ctxFont = ctxFont;
                            cmd.fontSize = fontSize;
                            cmd.height = charHeight;
                            cmd.style = this._textStyle;
                        }
                    }
                    else {
                        let space = cmd.x + cmd.width - rectWidth;
                        let remove = space < 5 ? 2 : space < 10 ? 1 : 0; //视剩余空间删减字符数量
                        let min = cmd === curLine.cmd ? 1 : 0; //如果是这行的第一个元素，则至少保留一个字符
                        let i = cmd.text.length;
                        while (i > min && remove > 0) {
                            if (Text_isLowSurrogate(cmd.text.charCodeAt(i - 1)))
                                i--;
                            i--;
                            remove--;
                        }
                        cmd.text = cmd.text.substring(0, i) + Text_ellipsisStr;
                    }
                    cmd.width = this.getTextWidth2(cmd.text, cmd.ctxFont, cmd.fontSize);
                    cmd.next = null;
                    done = true;
                    this.addLine(true);//重新计算最后一行行高
                }

                cmd = next;
            }

            if (done || linesDeleted)
                this.calcTextSize();
        }

        if (this._onPostLayout)
            this._onPostLayout();

        //处理水平对齐
        let align = this._textStyle.align == "center" ? 1 : (this._textStyle.align == "right" ? 2 : 0);
        if (align != 0 && this._isWidthSet) {
            let rectWidth = this._width - padding[3] - padding[1];
            for (let line of this._lines) {
                let offsetX = 0;
                if (align == 1)
                    offsetX = Math.floor((rectWidth - line.width) * 0.5);
                else if (align == 2)
                    offsetX = rectWidth - line.width;

                if (offsetX > 0)
                    line.x = offsetX;
            }
        }

        //处理垂直对齐
        if (this._isHeightSet && this._textHeight < this._height) {
            let offsetY = 0;
            if (this._textStyle.valign === "middle")
                offsetY = Math.floor((this._height - this._textHeight) * 0.5);
            else if (this._textStyle.valign === "bottom")
                offsetY = this._height - this._textHeight;

            if (offsetY > 0) {
                for (let line of this._lines) {
                    line.y += offsetY;
                }
            }
        }

        if (this._overflow == Text.SCROLL
            && (this._isWidthSet && this._textWidth > this._width || this._isHeightSet && this._textHeight > this._height)) {
            if (!this._scrollPos)
                this._scrollPos = new Point(0, 0);
            else {
                let maxScrollX = this.maxScrollX;
                let maxScrollY = this.maxScrollY;
                if (this._scrollPos.x > maxScrollX)
                    this._scrollPos.x = maxScrollX;
                if (this._scrollPos.y > maxScrollY)
                    this._scrollPos.y = maxScrollY;
            }
        }
        else
            this._scrollPos = null;

        if (this._objContainer) {
            this._objContainer.size(this._width, this._height);

            if (this._scrollPos || this._overflow == Text.HIDDEN && this._objContainer.numChildren > 0) {
                let rect = this._objContainer.scrollRect || new Rectangle();
                let rectWidth = this._isWidthSet ? this._width : this._textWidth;
                let rectHeight = this._isHeightSet ? this._height : this._textHeight;
                this._objContainer.scrollRect = rect.setTo(0, 0, rectWidth, rectHeight);
            }
            else
                this._objContainer.scrollRect = null;
        }

        this._updatingLayout = false;

        // caochangli 执行完毕 - 清理持有的对象
        this.layout_padding = undefined;
        this.layout_curLine = undefined;
        this.layout_lastCmd = undefined;
        this.layout_textRender = undefined;
        // caochangli 执行完毕 - 清理持有的对象

        this.renderText();
    }



//#region caochangli - 采用独立方法优化写法
    private layout_wordWrap:boolean;
    private layout_padding:number[];
    private layout_rectWidth:number;
    private layout_alignItems:number;
    private layout_lineX:number; layout_lineY:number;
    private layout_curLine: ITextLine;
    private layout_lastCmd: ITextCmd;
    private layout_charWidth: number; layout_charHeight: number;
    private layout_fontSize: number;
    private layout_ctxFont: string;
    private layout_textRender:TextRender;
    private getTextWidth(text:string):number {
        if (this._bitmapFont)
            return this._bitmapFont.getTextWidth(text, this.layout_fontSize);
        else {
            let ret = TextRender.measureText(text);//Browser.context.measureText(text);
            return ret ? ret.width : 100;
        }
    }
    private getTextWidth2(text:string,font:string,fontSize:number):number {
        if (this._bitmapFont) {
            return this._bitmapFont.getTextWidth(text, fontSize);
        }
        else {
            let t = Browser.context.font;
            Browser.context.font = font;
            let ret = TextRender.measureText(text);//Browser.context.measureText(text);
            Browser.context.font = t;
            return ret ? ret.width : 100;
        }
    }
    private buildLines(text:string,style:TextStyle):void {
        this.layout_fontSize = Math.floor(style.fontSize * this._fontSizeScale);
        if (this.layout_fontSize == 0)
            this.layout_fontSize = 1;

        if (this._bitmapFont) {
            this.layout_charWidth = this._bitmapFont.getMaxWidth(this.layout_fontSize);
            this.layout_charHeight = this._bitmapFont.getMaxHeight(this.layout_fontSize);
        } else {
            Browser.context.font = this.layout_ctxFont = (style.bold ? "bold " : "") + this.layout_fontSize + "px " + this._realFont;
            this.layout_charWidth = this.layout_fontSize;
            this.layout_charHeight = this.layout_textRender.getFontHeight(this._realFont, this.layout_fontSize, style.bold);
        }

        let lines = text.split("\n");
        if (this.layout_wordWrap) {
            for (let i = 0, n = lines.length; i < n; i++) {
                let line = lines[i];
                if (line.length > 0)
                    this.wrapText(line, style);
                if (i != n - 1) {
                    this.addLine();
                }
            }
        }
        else {
            for (let i = 0, n = lines.length; i < n; i++) {
                let line = lines[i];
                if (line.length > 0)
                    this.addCmd(line, style, null);
                if (i != n - 1) {
                    this.addLine();
                }
            }
        }
    }

    private addCmd(target: string | IHtmlObject, style: TextStyle, width?: number):void {
        let cmd: ITextCmd = Text_cmdPool.length > 0 ? Text_cmdPool.pop() : <any>{};
        cmd.x = this.layout_lineX;
        cmd.y = this.layout_lineY;
        if (typeof (target) === "string") {
            if (!width)
                width = this.getTextWidth(target);
            cmd.text = target;
            cmd.ctxFont = this.layout_ctxFont;
            cmd.fontSize = this.layout_fontSize;
            cmd.width = width;
            cmd.height = this.layout_charHeight;
        }
        else {
            cmd.obj = target;
            cmd.width = target.width;
            cmd.height = target.height;
            if (target.width > 0) {
                cmd.x++;
                cmd.width += 2;
            }
        }
        cmd.style = style;
        cmd.linkEnd = false;
        cmd.next = null;
        cmd.prev = this.layout_lastCmd;
        this.layout_lineX += Math.round(cmd.width);

        if (this.layout_lastCmd)
            this.layout_lastCmd.next = cmd;
        else
            this.layout_curLine.cmd = cmd;
        this.layout_lastCmd = cmd;
    }

    private moveCmds(cmd: ITextCmd):void {
        while (cmd.linkEnd && cmd.next) { //跳过空链接的结束符
            cmd = cmd.next;
        }
        if (!cmd)
            return;

        cmd.prev.next = null;
        while (cmd) {
            let next = cmd.next;
            cmd.x = this.layout_lineX;
            cmd.y = this.layout_lineY;
            cmd.next = null;
            cmd.prev = this.layout_lastCmd;
            this.layout_lineX += Math.round(cmd.width);

            if (this.layout_lastCmd)
                this.layout_lastCmd.next = cmd;
            else
                this.layout_curLine.cmd = cmd;
            this.layout_lastCmd = cmd;
            cmd = next;
        }
    }

    private splitCmd(cmd: ITextCmd, pos: number):boolean {
        let ccode = cmd.text.charCodeAt(pos);
        if (Text_isLowSurrogate(ccode))
            pos--;
        if (pos == 0)
            return false;

        let str = cmd.text.substring(pos);

        cmd.text = cmd.text.substring(0, pos);
        cmd.width = this.getTextWidth2(cmd.text, cmd.ctxFont, cmd.fontSize);

        let cmd2: ITextCmd = Text_cmdPool.length > 0 ? Text_cmdPool.pop() : <any>{};
        cmd2.text = str;
        cmd2.style = cmd.style;
        cmd2.ctxFont = cmd.ctxFont;
        cmd2.fontSize = cmd.fontSize;
        cmd2.width = this.getTextWidth2(str, cmd.ctxFont, cmd.fontSize);
        cmd2.height = cmd.height;

        cmd2.next = cmd.next;
        cmd2.prev = cmd;
        cmd.next = cmd2;

        return true;
    }

    private addLine(last?: boolean):ITextLine {
        this.layout_lineX = 0;
        if (this.layout_curLine) {
            //计算行高
            let lineHeight = 0;
            let lineWidth = 0;
            let cmd = this.layout_curLine.cmd;
            while (cmd) {
                if (cmd.height > lineHeight) lineHeight = cmd.height;
                lineWidth += cmd.width;
                cmd = cmd.next;
            }

            //调整元素y位置
            cmd = this.layout_curLine.cmd;
            while (cmd) {
                if (this.layout_alignItems == 1)
                    cmd.y = Math.floor((lineHeight - cmd.height) * 0.5);
                else if (this.layout_alignItems == 2)
                    cmd.y = Math.floor((lineHeight - cmd.height));
                else
                    cmd.y = 0;
                cmd = cmd.next;
            }

            if (lineHeight == 0)
                lineHeight = this.layout_charHeight;
            lineHeight++; //预留一个像素用来放下划线

            this.layout_curLine.height = lineHeight;
            this.layout_curLine.width = Math.round(lineWidth);

            this.layout_lineY += this.layout_curLine.height + Math.floor(this._textStyle.leading * this._fontSizeScale);
        }

        if (last)
            return null;

        this.layout_curLine = Text_linePool.length > 0 ? Text_linePool.pop() : <any>{};
        this.layout_curLine.x = 0;
        this.layout_curLine.y = this.layout_lineY;
        this._lines.push(this.layout_curLine);
        this.layout_lastCmd = null;

        return this.layout_curLine;
    }

    private wrapText(text: string, style: TextStyle):void {
        let remainWidth = Math.max(0, this.layout_rectWidth - this.layout_lineX);

        let tw = this.getTextWidth(text);
        //优化1，如果一行小于宽度，则直接跳过遍历
        if (tw <= remainWidth) {
            this.addCmd(text, style, tw);
            return;
        }

        let maybeIndex = 0;
        let wordWidth = 0;
        let startIndex = 0;
        let isPunc: boolean;
        let testResult: RegExpExecArray;

        let isEmoji = Text_emojiTest.test(text);
        if (!this._bitmapFont && !isEmoji) {
            //优化2，预算第几个字符会超出，减少遍历及字符宽度度量
            maybeIndex = Math.floor(remainWidth / this.layout_charWidth);
            if (maybeIndex != 0)
                wordWidth = this.getTextWidth(text.substring(0, maybeIndex));
        }

        let len = text.length;
        for (let j = maybeIndex; j < len; j++) {
            let cc = text.charAt(j);
            let ccode = cc.charCodeAt(0);

            if (isEmoji && Text_isHighSurrogate(ccode) && j + 1 < len)
                cc += text.charAt(j + 1);

            tw = this.getTextWidth(cc);
            wordWidth += tw;

            if (wordWidth <= remainWidth || j === startIndex && this.layout_lineX === 0) { //一行如果连一个字符都放不下，强制放一个
                if (cc.length > 1) //emoji
                    j++;
                continue;
            }

            let part = text.substring(startIndex, j);
            wordWidth -= tw;

            //如果换行位置是字母或标点符号，需要向前查找单词的边界，避免单词被拆开
            //如果是标点符号，还需要保证不在行首
            if (this._wordWrap && ((ccode >= 65 && ccode <= 90) || (ccode >= 97 && ccode <= 122) //英文字符
                || (ccode >= 48 && ccode <= 57) // 0-9
                || (isPunc = Text_punctuationChars.includes(ccode)))) {
                let wb = part.length > 0 ? ((testResult = Text_wordBoundaryTest.exec(part)) ? testResult.index : null) : 0;
                if (wb > 0) { //边界在文本中间
                    if (wb > part.length - Text_maxWordLength) { //限制字符个数，超过的不看做一个单词
                        j = startIndex + wb;
                        part = text.substring(startIndex, j);
                        wordWidth = null; //part指向的字符串已改变，wordWidth无效
                        tw = null; //j指向的字符已改变，tw无效
                    }
                    //else 做默认处理即可
                }
                else if (wb != null && this.layout_lastCmd != null) { //未找到边界，还需要向前面的元素查找
                    let cmd = this.layout_lastCmd;
                    let totalLen = part.length;
                    let newLine = false;
                    while (cmd) {
                        if (cmd.width > 0) {
                            if (cmd.obj != null)
                                break;

                            testResult = Text_wordBoundaryTest.exec(cmd.text);
                            let textLen = cmd.text.length;
                            if (testResult == null) { //边界就在文本的末尾
                                this.addLine();
                                if (isPunc && totalLen == 0) { //再次检查标点符号不能在行首
                                    if (this.splitCmd(cmd, textLen - 1)) //将最后一个字符移到下一行
                                        this.moveCmds(cmd.next);
                                    else if (cmd.x > 0) //如果命令不在行首，整个命令移到下一行
                                        this.moveCmds(cmd);
                                }
                                else if (cmd.next != null)
                                    this.moveCmds(cmd.next);

                                newLine = true;
                                break;
                            }
                            else if (testResult.index > 0) {
                                if (testResult.index > textLen - (Text_maxWordLength - totalLen)) { //限制字符个数，超过的不看做一个单词
                                    this.addLine();
                                    this.splitCmd(cmd, testResult.index);
                                    this.moveCmds(cmd.next);

                                    newLine = true;
                                }
                                break;
                            }
                            else {
                                totalLen += textLen; // 继续向前
                                if (totalLen >= Text_maxWordLength)
                                    break;
                            }
                        }
                        cmd = cmd.prev;
                    }

                    if (newLine) {
                        remainWidth = this.layout_rectWidth - this.layout_lineX;
                        if (wordWidth + tw < remainWidth) {
                            wordWidth += tw;
                            continue; //然后继续下一字符即可
                        }
                        //else j对应的字符也放不下了，那么和默认处理逻辑是一样的
                    }
                }
                else { //边界就在文本的末尾
                    if (isPunc) { //标点符号不允许在行首
                        let b = (isEmoji && j >= 1 && Text_isLowSurrogate(text.charCodeAt(j - 1))) ? 2 : 1;
                        if (j - b > startIndex || this.layout_lineX > 0) { //这里有个边界判断，如果只剩一个字符了，并且在行头，就不能移动了
                            j -= b; //回退一个字符
                            part = text.substring(startIndex, j);
                            wordWidth = null; //part指向的字符串已改变，wordWidth无效
                            tw = null; //j指向的字符已改变，tw无效
                        }
                    }
                    //else 做默认处理即可
                }
            }

            if (part.length > 0)
                this.addCmd(part, style, wordWidth);
            this.addLine();

            startIndex = j;
            remainWidth = this.layout_rectWidth;
            wordWidth = null;

            if (maybeIndex > 1)
                j += maybeIndex - 1;
            else if (tw != null) { //一个优化，如果是单字符遍历，而且j还是指向当前字符，那么直接用tw就行
                wordWidth = tw;
                if (cc.length > 1)
                    j++;
            }
            else if (isEmoji && Text_isHighSurrogate(text.charCodeAt(j)))
                j++;

            if (wordWidth == null && j < len - 1)
                wordWidth = this.getTextWidth(text.substring(startIndex, j + 1));
        }

        this.addCmd(text.substring(startIndex, len), style);
    }

    private calcTextSize():void {
        let nw: number = 0, nh: number = 0;
        for (let line of this._lines) {
            if (line.width > nw)
                nw = line.width;
        }
        if (nw > 0)
            nw += this.layout_padding[1] + this.layout_padding[3];
        this._textWidth = nw;

        let lastLine = this._lines[this._lines.length - 1];
        if (lastLine)
            nh = lastLine.y + lastLine.height;
        if (nh > 0)
            nh += this.layout_padding[0] + this.layout_padding[2];
        this._textHeight = nh;
    };

    private doLayoutRun():void {
        this.layout_lineX = this.layout_lineY = this.layout_charWidth = this.layout_charWidth = 0;
        this.layout_curLine = null;
        this.layout_lastCmd = null;

        Text_recoverLines(this._lines);
        this.addLine();

        let elements = this._elements;
        for (let i = 0, n = elements.length; i < n; i++) {
            let ele = elements[i];
            if (ele.type == HtmlElementType.Text) {
                this.buildLines(ele.text, ele.style);
            }
            else if (ele.type == HtmlElementType.LinkEnd) {
                if (this.layout_lastCmd)
                    this.layout_lastCmd.linkEnd = true;
            }
            else {
                let htmlObj = ele.obj;
                if (!htmlObj) {
                    let cls = HtmlParser.classMap[ele.type];
                    if (cls) {
                        htmlObj = Pool.createByClass(cls);
                        htmlObj.create(this, ele);
                        ele.obj = htmlObj;
                    }
                }

                if (htmlObj) {
                    if (this.layout_wordWrap) {
                        let remainWidth = this.layout_rectWidth - this.layout_lineX;
                        if (htmlObj.width > 0 && remainWidth < htmlObj.width + 1) {
                            if (this.layout_lineX > 0) { //如果已经是开始位置了，就算放不下也不换行
                                this.addLine();
                            }
                        }
                    }
                    this.addCmd(htmlObj, ele.style);
                }
            }
        }

        this.addLine(true);
        this.calcTextSize();
    }
//#endregion caochangli - 采用独立方法优化写法


    /**
     * @en Render the text.
     * @zh 渲染文字。
     */
    protected renderText(): void {
        let graphics = this.graphics;
        graphics.clear(true, this._bgDrawCmd);

        this._fontGlobalScale = TextRenderConfig.fontScale;

        let padding = this._padding;
        let paddingLeft = padding[3];
        let paddingTop = padding[0];
        let bfont = this._bitmapFont;
        let scrollPos = this._scrollPos;
        let rectWidth = this._isWidthSet ? this._width : this._textWidth;
        let rectHeight = this._isHeightSet ? this._height : this._textHeight;
        let bottom = rectHeight - padding[2];
        let clipped = this._overflow == Text.HIDDEN || this._overflow == Text.SCROLL;

        rectWidth -= (padding[3] + padding[1]);
        rectHeight -= (padding[0] + padding[2]);

        let x = 0, y = 0;
        let lines = this._lines;
        let lineCnt = lines.length;
        let curLink: HtmlLink;
        let linkStartX: number;
        for (let i = 0; i < lineCnt; i++) {
            let line = lines[i];
            x = paddingLeft + line.x;
            y = paddingTop + line.y;
            if (scrollPos) {
                x -= scrollPos.x;
                y -= scrollPos.y;
            }
            let lineClipped = clipped && ((y + line.height) <= paddingTop || y >= bottom);

            let cmd = line.cmd;
            while (cmd) {
                //#region liurui link类型的富文本点击区域添加下划线和间隔高度
                const underlineGap = 1; // 下划线间距，之前是0，贴的太近了
                const underlineRate = 1 / 12; // 下划线宽度占比，之前是1/16
                if (cmd.linkEnd) {
                    if (curLink) {
                        const thickness = Math.max(1, cmd.fontSize * underlineRate);
                        curLink.addRect(linkStartX, y, x + cmd.x + cmd.width - linkStartX, line.height + thickness + underlineGap);
                        curLink = null;
                    }
                }
                //#endregion liurui link类型的富文本点击区域添加下划线和间隔高度

                if (cmd.obj) {
                    cmd.obj.pos(x + cmd.x, y + cmd.y);

                    if (cmd.obj.element.type == HtmlElementType.Link) {
                        curLink = <HtmlLink>cmd.obj;
                        curLink.resetArea();
                        linkStartX = x + cmd.x;
                    }
                }
                else if (!lineClipped) {
                    if (bfont) {
                        let tx: number = 0;
                        let str = cmd.text;
                        let color = bfont.tint ? cmd.style.color : "#FFFFFF";
                        let scale = Math.floor((bfont.autoScaleSize ? cmd.style.fontSize : bfont.fontSize) * this._fontSizeScale) / bfont.fontSize;
                        for (let i = 0, n = str.length; i < n; i++) {
                            let c = str.charCodeAt(i);
                            let g = bfont.dict[c];
                            if (g) {
                                if (g.texture)
                                    graphics.drawImage(g.texture, x + cmd.x + tx + g.x * scale, y + cmd.y + g.y * scale, g.width * scale, g.height * scale, color);
                                tx += Math.round(g.advance * scale);
                            }
                        }
                    } else {
                        let gcmd = FillTextCmd.create(cmd.text, x + cmd.x, y + cmd.y, null, cmd.style.color, null, cmd.style.stroke, cmd.style.strokeColor);
                        gcmd.fontFamily = this._realFont;
                        gcmd.fontSize = cmd.fontSize;
                        gcmd.bold = cmd.style.bold;
                        gcmd.italic = cmd.style.italic;
                        gcmd.singleCharRender = this._singleCharRender;
                        gcmd._preMeasuredWidth = cmd.width;
                        graphics.addCmd(gcmd);
                    }
                }

                if (!lineClipped && cmd.width > 0) {
                    if (cmd.style.underline) {
                        //#region liurui link类型的富文本下划线位置+调整
                        let thickness = Math.max(1, cmd.fontSize * underlineRate);
                        let fromY = y + line.height + underlineGap;
                        let toY = fromY;
                        let underlineColor = ColorUtils.create(cmd.style.underlineColor || cmd.style.color).strColor;
                        graphics.drawLine(x + cmd.x, fromY, x + cmd.x + cmd.width, toY, underlineColor, thickness);
                        //#endregion liurui link类型的富文本下划线位置+调整
                    }
                    if (cmd.style.strikethrough) {
                        //画删除线
                        let thickness = Math.max(1, cmd.fontSize / 16);
                        let stx = x + cmd.x;
                        let sty = (y + line.height / 2 - thickness) | 0;
                        let ext = 4;
                        graphics.drawLine(stx - ext, sty, stx + cmd.width + ext, sty, cmd.style.strikethroughColor || cmd.style.color, thickness);
                    }
                }

                cmd = cmd.next;
            }

            if (curLink) {
                curLink.addRect(linkStartX, y, rectWidth - linkStartX + paddingLeft, line.height);
                linkStartX = paddingLeft;
            }
        }

        if (clipped) {
            this._updateScrollRect();
        }
    }

    /**
     * @en Draw background
     * @zh 绘制背景
     */
    protected drawBg() {
        let cmd = this._bgDrawCmd;
        if (this._bgColor || this._borderColor) {
            if (!cmd) {
                cmd = new DrawRectCmd();
                cmd.x = cmd.y = 0;
                cmd.width = cmd.height = 1;
                cmd.percent = true;
                (cmd as IGraphicsCmd).lock = true;
                this._bgDrawCmd = cmd;
            }
            cmd.fillColor = this._bgColor;
            cmd.lineColor = this._borderColor;
            cmd.lineWidth = this._borderColor ? 1 : 0;

            let cmds = this.graphics.cmds;
            let i = cmds.indexOf(cmd);
            if (i !== 0) {
                if (i !== -1)
                    cmds.splice(i, 1);
                cmds.unshift(cmd);
                this.graphics.cmds = cmds;
            }
            else
                this.graphics.repaint();
        }
        else if (cmd) {
            this.graphics.removeCmd(cmd, true);
            this._bgDrawCmd = null;
        }
    }

    /** @ignore */
    protected _setParent(value: Node, index: number = -1): void {
        super._setParent(value, index);

        if (value && this._fontGlobalScale != null && this._fontGlobalScale !== TextRenderConfig.fontScale) {
            this.repaint();
        }
    }

    /**
     * @en The way text content fits.
     * @zh 文本内容适应方式。
     */
    get fitContent(): TextFitContent {
        return this._fitContent;
    }

    set fitContent(value: TextFitContent) {
        if (this._fitContent != value) {
            if ((value == TextFitContent.Both || value == TextFitContent.Height)
                && !SerializeUtil.isDeserializing
                && (!this._getBit(NodeFlags.EDITING_NODE) || this.textWidth > 0 && this.textHeight > 0)) {
                if (value == TextFitContent.Height)
                    this.height = this.textHeight;
                else
                    this.size(this.textWidth, this.textHeight);
            }
            this._fitContent = value;
        }
    }

    /**
     * @ignore
     */
    size(width: number, height: number): this {
        if (this._fitContent == TextFitContent.Both && !this._fitFlag
            && (!this._getBit(NodeFlags.EDITING_NODE) || this.textWidth > 0))
            width = this._width; //锁定了width

        if ((this._fitContent == TextFitContent.Both || this._fitContent == TextFitContent.Height) && !this._fitFlag
            && (!this._getBit(NodeFlags.EDITING_NODE) || this.textHeight > 0))
            height = this._height; //锁定了height

        return super.size(width, height);
    }

    // /** @ignore */
    protected _onPostLayout() {
        if ((this._fitContent == TextFitContent.Both || this._fitContent == TextFitContent.Height)
            && (!this._getBit(NodeFlags.EDITING_NODE) || this.textWidth > 0 && this.textHeight > 0)) {
            this._fitFlag = true;
            if (this._fitContent == TextFitContent.Height)
                this.height = this.textHeight;
            else
                this.size(this.textWidth, this.textHeight);
            this._fitFlag = false;
        }
    }

    /** @internal @blueprintEvent */
    GTextField_bpEvent: {
        [Event.LINK]: (href: string) => void;
    };
}