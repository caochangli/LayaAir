import { ILaya } from "../../ILaya";
import { NodeFlags } from "../Const";
import { Event } from "../events/Event";
import { SerializeUtil } from "../loaders/SerializeUtil";
import { Loader } from "../net/Loader";
import { Texture } from "../resource/Texture";
import { GWidget } from "./GWidget";
import { ImageRenderer } from "./ImageRenderer";
import { IMeshFactory } from "../display/mesh/MeshFactory";
import { AssetDb } from "../resource/AssetDb";
import { AssetGroup, IAssetGroup } from "../sgsExpand/loader/AssetGroup";
import { LayaEnv } from "../../LayaEnv";

/**
 * @en GImage is a widget that displays an image resource. Set the image resource URL using the src property. By default, the autoSize property is true, so the node will automatically adjust to the original size of the image when the src is changed; if you want the node size not to change with the image size, you can set the autoSize property to false.
 * @zh GImage 是一个显示图像资源的小部件。 使用src属性设置图像资源的URL。默认情况下，autoSize属性为true，所以更改src后，节点会自动调整为图像的原始大小；如果希望节点大小不跟随图像大小变化，可以将autoSize属性设置为false。
 * @blueprintInheritable
 */
export class GImage extends GWidget {
    private _src: string = "";
    private _color: string;
    private _autoSize: boolean;
    private _loadId: number = 0;

    private _renderer: ImageRenderer;

    // caochangli - 是否是Button的Image
    private _isBtnImage:boolean;

    constructor() {
        super();

        this._color = "#ffffff";
        this._autoSize = true;
        this._renderer = new ImageRenderer(this);
        this._renderer._onReload = () => this.onTextureReload();
    }

    //caochangli - 通过onAfterDeserialize接口处理预制序列化完成后的逻辑
    onAfterDeserialize() {
        super.onAfterDeserialize();
        if (this._autoSize) {
            if (this._renderer._tex)
                this.size(this._renderer._tex.sourceWidth, this._renderer._tex.sourceHeight);
            else if (!this._getBit(NodeFlags.EDITING_NODE))
                this.size(0, 0);
            this._autoSize = true;
        }
    }

    /**
     * caochangli - 增加主动设置九宫格(纹理有以纹理九宫格为准，纹理无以设置的为准)
     * @param value - 顺序：上、右、下、左、是否重复填充(0、1 - 可缺省，缺省则默认0)
     */
    setSizeGrid(value: Array<number>) {
        if (value)
        {
            let length:number = value.length;
            if (length < 4)
            {
                console.error(`九宫格设置非法，请至少设置四边：${value}`);
                return;
            }
            else if (length > 5)
            {
                console.error(`九宫格设置非法，只能设置四边和是否填充：${value}`);
                return;
            }
            // 缺少是否填充 - 默认不填充
            else if (length == 4)
                value.push(0);
        }
        this._renderer.setSizeGrid(value);
    }

    /**
     * @en The source URL of the image resource.
     * @zh 图像资源的源 URL。
     */
    get src(): string {
        return this._src;
    }

    /**
     * 只能加载单图 - 如果传入的是还未加载的图集散图，则无法加载成功(如果图集已经加载过了，倒是可以)。
     */
    set src(value: string) {
        if (value == null)
            value = "";
        if (this._src == value)
            return;

        this._src = value;
        let loadID = ++this._loadId;
        // if (value) {
        //     //在反序列化时，禁止立刻设置texture，因为autoSize值还没反序列化
        //     let tex = SerializeUtil.isDeserializing ? null : Loader.getRes(value);
        //     if (tex)
        //         this.onLoaded(tex, loadID);
        //     else
        //         ILaya.loader.load(value, Loader.IMAGE).then(res => this.onLoaded(res, loadID));
        // }
        // else
        //     this.onLoaded(null, loadID);

        //caochangli - 走业务层资源管理器
        this._loadSrcImage(loadID);
    }

    //caochangli - 走业务层资源管理器
    private _srcAssetGroup:IAssetGroup;
    private _loadSrcImage(loadID:number) {

        //空路径
        if (!this._src)
        {
            // caochangli - button按钮换肤不需要取消加载
            if (!this._isBtnImage)
                this._cancelSrcLoad();
            this.onLoaded(null, loadID);
            return;
        }

        //本次需要的资源正在加载中 - 等待加载完成
        if (this._srcAssetGroup && this._srcAssetGroup.IsResLoading(this._src))
            return;

        if (!this._srcAssetGroup)
            this._srcAssetGroup = AssetGroup.Get();
         // caochangli - button按钮换肤不需要取消加载
        else if (!this._isBtnImage)
            this._srcAssetGroup.CancelAllAssets(true);

        //没有获取到AssetGroup - 走引擎原逻辑
        if (!this._srcAssetGroup)
        {
            let tex = Loader.getRes(this._src);
            if (tex)
                this.onLoaded(tex, loadID);
            else
                ILaya.loader.load(this._src, Loader.IMAGE).then(res => this.onLoaded(res, loadID));
            return;
        }

        let tex:Texture = Loader.getRes(this._src);
        
        // caochangli - 预览模式图片中散图因uuid和路径映射关系还没有,获取不到纹理问题修复
        if (!tex && LayaEnv.isPreview)
            tex = AssetDb.inst.previewAtlasTexture(this._src);
        
        if (tex && tex.url)
        {   
            //图集中小图 - 计数记到图集上
            if (tex._atlas && tex._atlas.url)
                this._srcAssetGroup.OnlyAddReference(tex._atlas.url);
            else
                this._srcAssetGroup.OnlyAddReference(tex.url,tex);
            this.onLoaded(tex, loadID);
        }
        else//需要加载资源
        {
            //清空上一次纹理
            this._renderer.setTexture(null);

            //预览模式 - 将uuid转成url
            if (LayaEnv.isPreview)
            {
                AssetDb.inst.uuidToUrl(this._src,(uuid:string,url:string)=>{
                    if (!this.destroyed && this._src && uuid == this._src)
                    {
                        if (!url)
                            this.onLoaded(null, loadID);
                        else
                            this._srcAssetGroup.Load(url,Loader.IMAGE,this,(url:string,res:Texture)=>{
                                if (url == this._src || uuid == this._src)//需要的资源正在加载中时会被挡掉，但当加载完时loadID又没对上
                                    loadID = this._loadId;
                                this.onLoaded(res, loadID);
                            });
                    }
                });
            }
            //生产模式 - 没有uuid，都是用路径加载的
            else
                this._srcAssetGroup.Load(this._src,Loader.IMAGE,this,(url:string,res:Texture)=>{
                    if (url == this._src)//需要的资源正在加载中时会被挡掉，但当加载完时loadID又没对上
                        loadID = this._loadId;
                    this.onLoaded(res, loadID);
                });
        }
    }
    private _cancelSrcLoad() {
        if (this._srcAssetGroup)
            this._srcAssetGroup.CancelAllAssets(true);
    }

    /**
     * @en The texture of the image.
     * @zh 图像的纹理。
     */
    get texture(): Texture {
        return this._renderer._tex;
    }

    set texture(value: Texture) {
        if (this._renderer._tex === value)
            return;
        this._src = value && value.url || "instance-0";
        // caochangli - button按钮换肤不需要取消加载
        if (!this._isBtnImage)
            this._cancelSrcLoad();
        this.onLoaded(value, ++this._loadId);
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

    /** @ignore */
    get icon(): string {
        return this.src;
    }

    set icon(value: string) {
        this.src = value;
    }

    /**
     * @en Whether to use the original size of the resource.
     * @zh 是否使用资源的原始大小。
     */
    get autoSize(): boolean {
        return this._autoSize;
    }

    set autoSize(value: boolean) {
        if (this._autoSize != value) {
            // caochangli - 序列化中暂不处理
            if (value && this._renderer._tex && !SerializeUtil.isDeserializing)
                this.size(this._renderer._tex.sourceWidth, this._renderer._tex.sourceHeight);
            this._autoSize = value; //放最后，因为size会改变autoSize的值
        }
    }

    /**
     * @en The color of the object.
     * @zh 对象的颜色。
     */
    get color() {
        return this._color;
    }

    set color(value: string) {
        this._color = value;
        this._renderer.setColor(value);
    }

    protected onLoaded(tex: Texture, loadID: number) {
        if (this._loadId != loadID || this.destroyed)
            return;

        this._renderer.setTexture(tex);

        // caochangli - 序列化中暂不处理
        if (this._autoSize && !SerializeUtil.isDeserializing) {
            if (tex)
                this.size(tex.sourceWidth, tex.sourceHeight);
            else if (!this._getBit(NodeFlags.EDITING_NODE))
                this.size(0, 0);
            this._autoSize = true;
        }

        this.event(Event.LOADED);
    }

    private onTextureReload() {
        // caochangli - 序列化中暂不处理
        if (this._autoSize && !SerializeUtil.isDeserializing) {
            let tex = this._renderer._tex;
            this.size(tex.sourceWidth, tex.sourceHeight);
            this._autoSize = true;
        }

        this.event(Event.LOADED);
    }

    protected _sizeChanged(changeByLayout?: boolean): void {
        super._sizeChanged();

        if (!changeByLayout && !SerializeUtil.isDeserializing)
            this._autoSize = false;
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
    GImage_bpEvent: {
        [Event.LOADED]: () => void;
    };
}
