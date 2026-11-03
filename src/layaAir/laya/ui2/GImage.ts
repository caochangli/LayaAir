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
import { URL } from "../net/URL";

/**
 * @en GImage is a widget that displays an image resource. Set the image resource URL using the src property. By default, the autoSize property is true, so the node will automatically adjust to the original size of the image when the src is changed; if you want the node size not to change with the image size, you can set the autoSize property to false.
 * @zh GImage 是一个显示图像资源的小部件。 使用src属性设置图像资源的URL。默认情况下，autoSize属性为true，所以更改src后，节点会自动调整为图像的原始大小；如果希望节点大小不跟随图像大小变化，可以将autoSize属性设置为false。
 * @blueprintInheritable
 */
export class GImage extends GWidget {
    private _src: string = "";
    private _color: string;
    private _autoSize: boolean;
    // private _loadId: number = 0;
    private _loadUrl:string;//caochangli - 使用_loadUrl代替_loadId

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
     * 加载图片 - 若传入的是图集散图时会自动加载其所属图集，完成后取对应散图显示。
     */
    set src(value: string) {
        if (value == null)
            value = "";
        if (this._src == value)
            return;

        this._src = value;
        // let loadID = ++this._loadId;
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
        this._loadSrcImage();
    }

    //caochangli - 走业务层资源管理器
    private _srcAssetGroup:IAssetGroup;
    private _loadSrcImage() {

        //空路径
        if (!this._src)
        {
            // caochangli - button按钮换肤不需要取消加载
            this._isBtnImage ? this._loadUrl = null : this._cancelSrcLoad();
            this.onLoaded(null);
            return;
        }

        //本次需要的资源正在加载中 - 等待加载完成
        if (this._srcAssetGroup)
        {
            let loadKey = this._src;
            if (URL.isAtlasInImage(loadKey))
                loadKey = loadKey.substring(0, loadKey.lastIndexOf("/")) + ".atlas";
            if (this._srcAssetGroup.IsResLoading(loadKey))
                return;
        }

        if (!this._srcAssetGroup)
            this._srcAssetGroup = AssetGroup.Get();
        else// caochangli - button按钮换肤不需要取消加载
            this._isBtnImage ? this._loadUrl = null : this._cancelSrcLoad();

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
            this._loadUrl = this._src;
            this.onLoaded(tex);
        }
        else//需要加载资源
        {
            //清空上一次纹理
            this._renderer.setTexture(null);

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
        let loadType = Loader.IMAGE;
        if (URL.isAtlasInImage(srcUrl))//图集中散图 - 加载图集
        {
            loadUrl = srcUrl.substring(0,srcUrl.lastIndexOf("/")) + ".atlas";
            loadType = Loader.ATLAS;
        }
        this._loadUrl = loadUrl;
        this._srcAssetGroup.Load(loadUrl,loadType,this,(url:string,res:Texture)=>{
            if (url !== this._loadUrl)
                return;
            if (res && URL.isAtlasInImage(this._src))//图集中散图 - 以当前src转成对应散图资源
                res = <Texture>Loader.getRes(this._src);
            this.onLoaded(res);
        });
    }
    private _cancelSrcLoad() {
        this._loadUrl = null;
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
        this._isBtnImage ? this._loadUrl = null : this._cancelSrcLoad();
        this.onLoaded(value);
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

    protected onLoaded(tex: Texture) {//caochangli - 用_loadUrl代替_loadId
        // if (this._loadId != loadID || this.destroyed)
        //     return;
        if (this.destroyed)
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
