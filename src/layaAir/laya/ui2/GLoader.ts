
import { ILaya } from "../../ILaya";
import { AnimationStretchMode, FrameAnimation } from "../components/FrameAnimation";
import { HideFlags } from "../Const";
import { Sprite } from "../display/Sprite";
import { Event } from "../events/Event";
import { Loader } from "../net/Loader";
import { AtlasResource } from "../resource/AtlasResource";
import { Texture } from "../resource/Texture";
import { AlignType, LoaderFitMode, VAlignType } from "./Const";
import { GWidget } from "./GWidget";
import { ImageRenderer } from "./ImageRenderer";
import { IMeshFactory } from "../display/mesh/MeshFactory";
import { Material } from "../resource/Material";
import { AssetGroup, IAssetGroup } from "../sgsExpand/loader/AssetGroup";
import { LayaEnv } from "../../LayaEnv";
import { AssetDb } from "../resource/AssetDb";
import { URL } from "../net/URL";
import { Utils } from "../utils/Utils";

/**
 * @en GLoader is a widget that displays an image or animation resource.
 * @zh GLoader 是一个显示图像或动画资源的小部件。
 * @blueprintInheritable
 */
export class GLoader extends GWidget {
    private _src: string;
    private _align: AlignType;
    private _valign: VAlignType;
    private _fitMode: LoaderFitMode;
    private _shrinkOnly: boolean;
    private _color: string;
    private _frame: number = 0;
    private _autoPlay: boolean = true;
    private _loop: boolean = true;

    private _updatingLayout: boolean;
    private _content: Sprite;
    private _srcWidth: number = 0;
    private _srcHeight: number = 0;
    // private _loadId: number = 0;
    private _loadUrl:string;//caochangli - 使用_loadUrl代替_loadId

    private _renderer: ImageRenderer;
    private _ani: FrameAnimation;

    constructor() {
        super();

        this._src = "";
        this._color = "#ffffff";
        this._fitMode = LoaderFitMode.Contain;
        this._shrinkOnly = false;
        this._align = AlignType.Center;
        this._valign = VAlignType.Middle;
        this._content = new Sprite();
        this._content.hideFlags |= HideFlags.HideAndDontSave;
        this._renderer = new ImageRenderer(this._content);
        this._renderer._onReload = () => this.onTextureReload();
        this.addChild(this._content);
    }

    /**
     * @en The source URL of the image or animation resource.
     * @zh 图像或动画资源的源 URL。
     */
    get src(): string {
        return this._src;
    }

    set src(value: string) {
        if (value == null)
            value = "";
        if (this._src == value)
            return;
        this._src = value;
        // if (value)
        //     this.loadContent();
        // else
        //     this.clearContent();

        //caochangli - 走业务层资源管理器
        this._loadSrcImage();
    }

    /** @ignore */
    get icon(): string {
        return this._src;
    }

    set icon(value: string) {
        this.src = value;
    }

    /**
     * @en The alignment of the content within the loader.
     * @zh 加载器内内容的对齐方式。
     */
    get align(): AlignType {
        return this._align;
    }

    set align(value: AlignType) {
        if (this._align != value) {
            this._align = value;
            ILaya.timer.callLater(this, this.updateLayout);
        }
    }

    /**
     * @en The vertical alignment of the content within the loader.
     * @zh 加载器内内容的垂直对齐方式。
     */
    get valign(): VAlignType {
        return this._valign;
    }

    set valign(value: VAlignType) {
        if (this._valign != value) {
            this._valign = value;
            ILaya.timer.callLater(this, this.updateLayout);
        }
    }

    /**
     * @en The fit mode of the loader, which determines how the content is scaled to fit the loader's size.
     * @zh 加载器的适配模式，决定内容如何缩放以适应加载器的大小。
     */
    get fitMode(): LoaderFitMode {
        return this._fitMode;
    }

    set fitMode(value: LoaderFitMode) {
        if (this._fitMode != value) {
            this._fitMode = value;
            ILaya.timer.callLater(this, this.updateLayout);
        }
    }

    /**
     * @en Whether to only shrink the content to fit the loader's size, without enlarging it.
     * @zh 是否仅缩小内容以适应加载器的大小，而不放大它。
     */
    get shrinkOnly(): boolean {
        return this._shrinkOnly;
    }

    set shrinkOnly(value: boolean) {
        if (this._shrinkOnly != value) {
            this._shrinkOnly = value;
            ILaya.timer.callLater(this, this.updateLayout);
        }
    }

    /**
     * @en The color applied to the content of the loader.
     * @zh 应用于加载器内容的颜色。
     */
    get color(): string {
        return this._color;
    }

    set color(value: string) {
        this._color = value;
        this._renderer.setColor(value);
        if (this._ani)
            this._ani.color = this._ani.color.parse(value);
    }

    /**
     * @en The FrameAnimation component used for animations.
     * @zh 用于动画的 FrameAnimation 组件。
     */
    get ani(): FrameAnimation | null {
        return this._ani;
    }

    /**
     * @en The index of the current frame in the animation.
     * @zh 动画当前帧的索引。
     */
    get frame(): number {
        return this._frame;
    }

    set frame(value: number) {
        this._frame = value;
        if (this._ani)
            this._ani.frame = value;
    }

    /**
    * @en Whether to auto-play, default is false. If set to true, the animation will automatically play after being created and added to the stage.
    * @zh 是否自动播放，默认为false。如果设置为true，则动画被创建并添加到舞台后自动播放。
    */
    get autoPlay() {
        return this._autoPlay;
    }

    set autoPlay(value: boolean) {
        this._autoPlay = value;
        if (this._ani)
            this._ani.autoPlay = value;
    }

    /**
     * @en Whether to loop playback. Default is true.
     * @zh 是否循环播放。默认为 true。
     */
    get loop() {
        return this._loop;
    }

    set loop(value: boolean) {
        this._loop = value;
        if (this._ani)
            this._ani.loop = value;
    }

    /**
     * @en The texture of the image.
     * @zh 图像的纹理。
     */
    get texture(): Texture {
        return this._renderer._tex;
    }

    set texture(value: Texture) {
        // caochangli - 按新加载逻辑处理
        this._src = value && value.url || "instance-0";
        this._cancelSrcLoad();
        this.onLoaded(value);//, ++this._loadId);
    }

    /**
     * @en The mesh factory used for customizing the mesh of the image.
     * @zh 用于自定义图像网格的网格工厂。
     */
    get mesh(): IMeshFactory {
        return this._renderer._meshFactory;
    }

    set mesh(value: IMeshFactory) {
        this._renderer.setMesh(value);
    }

    get material(): Material {
        return this._content.material;
    }

    set material(value: Material) {
        this._content.material = value;
    }

    // protected loadContent() {
    //     let loadID = ++this._loadId;
    //     let res = Loader.getRes(this._src, Loader.IMAGE);
    //     if (!res)
    //         ILaya.loader.load(this._src, { maybeType: Loader.IMAGE }).then(res => this.onLoaded(res, loadID));
    //     else
    //         this.onLoaded(res, loadID);
    // }

    //caochangli - 走业务层资源管理器
    private _srcAssetGroup:IAssetGroup;
    private _loadSrcImage() {

        //空路径
        if (!this._src)
        {
            this.clearContent();
            return;
        }

        //本次需要的资源正在加载中 - 等待加载完成
        if (this._srcAssetGroup)
        {
            let loadKey = this._src;
            if (Utils.getFileExtension(loadKey) != Loader.ATLAS && URL.isAtlasInImage(loadKey))
                loadKey = loadKey.substring(0, loadKey.lastIndexOf("/")) + ".atlas";
            if (this._srcAssetGroup.IsResLoading(loadKey))
                return;
        }

        if (!this._srcAssetGroup)
            this._srcAssetGroup = AssetGroup.Get();
        else
            this._cancelSrcLoad();

        //没有获取到AssetGroup - 走引擎原逻辑
        if (!this._srcAssetGroup)
        {
            let loadKey = this._src;
            let loadType = Utils.getFileExtension(loadKey) == Loader.ATLAS ? Loader.ATLAS : Loader.IMAGE;
            if (loadType == Loader.IMAGE && URL.isAtlasInImage(loadKey))//图集中散图 - 加载图集
            {
                loadKey = loadKey.substring(0, loadKey.lastIndexOf("/")) + ".atlas";
                loadType = Loader.ATLAS;
            }
            ILaya.loader.load(loadKey, loadType).then(() => {
                let res = Loader.getRes(this._src);
                this.onLoaded(<Texture | AtlasResource>res);
            });
            return;
        }

        let tex:Texture | AtlasResource = Loader.getRes(this._src);
        
        // caochangli - 预览模式图片中散图因uuid和路径映射关系还没有,获取不到纹理问题修复
        if (!tex && LayaEnv.isPreview)
            tex = AssetDb.inst.previewAtlasTexture(this._src);
        
        if (tex && tex.url)
        {   
            //图集中小图 - 计数记到图集上
            if (tex instanceof Texture && tex._atlas && tex._atlas.url)
                this._srcAssetGroup.OnlyAddReference(tex._atlas.url);
            else
                this._srcAssetGroup.OnlyAddReference(tex.url,tex);
            this._loadUrl = this._src;
            this.onLoaded(tex);
        }
        else//需要加载资源
        {
            //清空上一次纹理
            this._renderer.setTexture(null);
            if (this._ani)
                this._ani.source = null;

            //预览模式 - 将uuid转成url
            if (LayaEnv.isPreview)
            {
                AssetDb.inst.uuidToUrl(this._src,(uuid:string,srcUrl:string)=>{
                    if (!this.destroyed && this._src && uuid == this._src)
                    {
                        if (!srcUrl)
                            this.onLoaded(null);
                        else 
                            this._startSrcLoad(srcUrl);
                    }
                });
            }
            //生产模式 - 没有uuid，都是用路径加载的
            else 
                this._startSrcLoad(this._src);
        }
    }
    private _startSrcLoad(srcUrl:string) {
        let loadUrl = srcUrl;
        let loadType = Utils.getFileExtension(srcUrl) == Loader.ATLAS ? Loader.ATLAS : Loader.IMAGE;
        if (loadType == Loader.IMAGE && URL.isAtlasInImage(srcUrl))//图集中散图 - 加载图集
        {
            loadUrl = srcUrl.substring(0,srcUrl.lastIndexOf("/")) + ".atlas";
            loadType = Loader.ATLAS;
        }
        this._loadUrl = loadUrl;
        this._srcAssetGroup.Load(loadUrl,loadType,this,(url:string,res:Texture | AtlasResource)=>{
            if (url !== this._loadUrl)
                return;
            if (res && URL.isAtlasInImage(this._src))//图集中散图 - 以当前src转成对应散图资源
                res = Loader.getRes(this._src);
            this.onLoaded(res);
        });
    }
    private _cancelSrcLoad() {
        this._loadUrl = null;
        if (this._srcAssetGroup)
            this._srcAssetGroup.CancelAllAssets(true);
    }
    //caochangli - 走业务层资源管理器

    protected onLoaded(value: Texture | AtlasResource) {//, loadID: number) {//caochangli - 用_loadUrl代替_loadId
        // if (this._loadId != loadID || this.destroyed)
        //     return;
        if (this.destroyed) 
            return;

        if (value instanceof Texture) {
            if (this._ani)
                this._ani.setAtlas(null);
            this._renderer.setTexture(value);

            this._srcWidth = value.sourceWidth;
            this._srcHeight = value.sourceHeight;
        }
        else if (value instanceof AtlasResource) {
            this._renderer.setTexture(null);
            if (!this._ani) {
                this._ani = this._content.addComponent(FrameAnimation);
                this._ani.color = this._ani.color.parse(this._color);
                this._ani.stretchMode = AnimationStretchMode.Fill;
                this._ani.autoPlay = this._autoPlay;
                this._ani.loop = this._loop;
                this._ani.frame = this._frame;
            }
            this._ani.setAtlas(value);
            this._srcWidth = this._ani.width;
            this._srcHeight = this._ani.height;
        }
        else {
            this._renderer.setTexture(null);
            if (this._ani)
                this._ani.setAtlas(null);
            this._srcWidth = 0;
            this._srcHeight = 0;
        }

        ILaya.timer.runCallLater(this, this.updateLayout, true);
        this.event(Event.LOADED);
    }

    private onTextureReload() {
        let tex = this._renderer._tex;
        this._srcWidth = tex.sourceWidth;
        this._srcHeight = tex.sourceHeight;
        ILaya.timer.runCallLater(this, this.updateLayout, true);
        this.event(Event.LOADED);
    }

    protected clearContent() {
        this._srcWidth = 0;
        this._srcHeight = 0;
        // this._loadId++;//caochangli - 用_loadUrl代替_loadId
        this._renderer.setTexture(null);
        if (this._ani)
            this._ani.source = null;
        this._cancelSrcLoad();//caochangli - 取消加载
    }

    protected updateLayout(): void {
        let cw = this._srcWidth, ch = this._srcHeight;
        if (cw == 0 || ch == 0)
            return;

        this._updatingLayout = true;
        let sx = 1, sy = 1;
        if (this._fitMode != LoaderFitMode.None && cw != 0 && ch != 0) {
            sx = this.width / cw;
            sy = this.height / ch;

            if (sx != 1 || sy != 1) {
                if (this._fitMode == LoaderFitMode.CoverHeight)
                    sx = sy;
                else if (this._fitMode == LoaderFitMode.CoverWidth)
                    sy = sx;
                else if (this._fitMode == LoaderFitMode.Contain) {
                    if (sx > sy)
                        sx = sy;
                    else
                        sy = sx;
                }
                else if (this._fitMode == LoaderFitMode.Cover) {
                    if (sx > sy)
                        sy = sx;
                    else
                        sx = sy;
                }

                if (this._shrinkOnly) {
                    if (sx > 1)
                        sx = 1;
                    if (sy > 1)
                        sy = 1;
                }

                cw = cw * sx;
                ch = ch * sy;
            }
        }

        this._content.size(cw, ch);

        let nx: number, ny: number;
        if (this._align == AlignType.Center)
            nx = Math.floor((this.width - cw) / 2);
        else if (this._align == AlignType.Right)
            nx = this.width - cw;
        else
            nx = 0;
        if (this._valign == VAlignType.Middle)
            ny = Math.floor((this.height - ch) / 2);
        else if (this._valign == VAlignType.Bottom)
            ny = this.height - ch;
        else
            ny = 0;

        this._content.pos(nx, ny);
        this._updatingLayout = false;
    }

    protected _sizeChanged(): void {
        super._sizeChanged();

        if (!this._updatingLayout)
            ILaya.timer.callLater(this, this.updateLayout);
    }

    /** @ignore */
    destroy(): void {
        super.destroy();
        this._renderer.destroy();

        //回收使用src接口加载的资源
        if (this._srcAssetGroup)
        {
            AssetGroup.Release(this._srcAssetGroup);
            this._srcAssetGroup = null;
        }
    }

    /** @internal @blueprintEvent */
    GLoader_bpEvent: {
        [Event.LOADED]: () => void;
    };
}
