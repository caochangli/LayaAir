import { LayaGL } from "../../laya/layagl/LayaGL";
import { VideoTexture } from "../../laya/media/VideoTexture";
import { URL } from "../../laya/net/URL";
import { PAL } from "../../laya/platform/PlatformAdapters";
import { Browser } from "../../laya/utils/Browser";
import { NativeVideoProxy } from "./NativeVideoProxy";

/**
 * caochangli - 备注：Laya原始缺少下列功能
 * 缺少功能接口，如：duration、muted、volume、playbackRate
 * 缺少事件通知，如：error
 * 对缺少的功能采用扩展桥接的方式实现了(目前仅实现了安卓)
 */
export class NativeVideoTexture extends VideoTexture {
    readonly decoder: any;

    //caochangli - 补充接口
    private _videoID:string;
    private _duration:number = 0;
    private _muted: boolean = false;
    private _volume: number = 1;
    private _playbackRate: number = 1;
    //caochangli - 补充接口

    private _currentTime: number;
    private _ended: boolean = false;
    private _waitFirstFrame: boolean = false;
    private _startOption: any;

    constructor() {
        super();
        //@ts-ignore
        this.decoder = PAL.g.createVideoDecoder({
            type: "wemedia" // 3.0.0以上基础库支持传入type参数
        });
        this.decoder.on(<any>"frame", (res: any) => {
            if (!this._destroyed) {
                this._currentTime = res.pts / 1000; // 当前播放的进度
                if (this._waitFirstFrame) {
                    this._waitFirstFrame = false;
                    if (!this._playing) {
                        //让画面显示出来，而不是黑色
                        this.render(true);
                        //@ts-ignore
                        this.decoder.wait(true);
                    }
                }
            }
        });
        this.decoder.on("ended", () => {
            if (!this._destroyed) {
                // caochangli备注：
                // Laya原始逻辑：native层播放完，js层判断循环就再次去native层创建视频播放(衔接闪烁等问题)
                // 修改方案：安卓(ios、鸿蒙待开发)采用将loop传到native层，由native层控制，那么循环播放这里就收不到ended事件了
                if (this._loop) {
                    this.decoder.stop().then(() => this.decoder.start(this._startOption));
                }
                else {
                    this._ended = true;
                    this.event("ended");
                }
            }
        });
    }

    get readyState(): number {
        return this._loaded ? 1 : 0;
    }

    get ended(): boolean {
        return this._ended;
    }

    get currentTime(): number {
        return this._currentTime;
    }

    set currentTime(value: number) {
        this.decoder.seek(value * 1000);
    }

    //caochangli - 补充接口(目前仅安卓支持了)
    get loop(): boolean {
        return this._loop;
    }

    set loop(value: boolean) {
        this._loop = value;
        this.callVideoHelper("setDecoderParam",{loop:!!value});
    }

    get duration(): number {
        return this._duration;
    }

    get muted(): boolean {
        return this._muted;
    }

    set muted(value: boolean) {
        this._muted = value;
        this.callVideoHelper("setDecoderParam",{muted:!!value});
    }

    get volume() {
        return this._volume;
    }
    set volume(value:number) {
        this._volume = value;
        this.callVideoHelper("setDecoderParam",{volume:value});
    }

    get playbackRate(): number {
        return this._playbackRate;
    }

    set playbackRate(value: number) {
        this._playbackRate = value;
        this.callVideoHelper("setDecoderParam",{rate:value});
    }
    //caochangli - 补充接口(目前仅安卓支持了)

    // caochangli - native环境下视频播放 - 先dcc下载到本地，再将本地路径传给native
    protected onLoad(url: string): void {
        this._ended = false;
        this._waitFirstFrame = false;

        // 先把远端地址格式化为 src
        let src = URL.postFormatURL(URL.formatURL(url));
        let dccClient = (window as any).dcc;

        const runStart = () => {
            if (this._destroyed || this._source !== url) return;

            if (!src || !dccClient || src.startsWith("https://") || src.startsWith("http://")) {
                this.onLoad1(src);
                return;
            }

            // 使用 dcc 把视频下载到本地，使用本地路径播放
            dccClient.updateFile(src).then((result: { isSucc: boolean, localPath: string }) => {
                if (!this._destroyed && this._source === url) {
                    if (result.isSucc && result.localPath)
                        this.onLoad1("[dccLocalPath]" + result.localPath);
                    else
                        this.onLoad1(src);
                }
            }, () => {
                if (!this._destroyed && this._source === url)
                    this.onLoad1(src);
            });
        };

        // 如果当前已经在播放，先 stop，避免 decoder.start 与 stop 并发
        if (this._loaded) {
            this._loaded = false;
            const ticket = this._source;
            this.decoder.stop().then(() => {
                // ticket 用于防止 stop 期间又发起了新的加载
                if (this._source === ticket)
                    runStart();
            });
        }
        else {
            runStart();
        }
    }
    protected onLoad1(url: string): void {
        // let src = this._source;
        // this._ended = false;
        // this._waitFirstFrame = false;
        // if (this._loaded)
        //     this.decoder.stop();
        // this._loaded = false;

        // if (this._source !== src)
        //     return;

        // caochangli - 注册扩展事件、组装url扩展参数
        this._videoID = NativeVideoProxy.createVideoID();
        NativeVideoProxy.registerVideoEvent(this._videoID,this);
        let expand = {videoID:this._videoID,loop:!!this._loop,muted:!!this._muted,volume:this._volume,rate:this._playbackRate};
        url += `[expand${JSON.stringify(expand)}expand]`;
        // caochangli - 注册扩展事件、组装url扩展参数

        this._startOption = {};
        this._startOption.source = url;//URL.postFormatURL(URL.formatURL(url));
        if (Browser.isIOSHighPerformanceModePlus)
            this._startOption.videoDataType = 2;

        this.decoder.start(this._startOption).then((res: any) => {
            if (!this._destroyed) {
                this.getDecoderInfo();//caochangli - 获取视频信息
                this.setLoaded(res.width, res.height, true);
                if (!this._playing)
                    this._waitFirstFrame = true;
            }
        }).catch((err: any) => {
            if (!this._destroyed) {
                console.warn("MgVideoTexture: " + err.message);
                this.event("error",err);
            }
        });
    }

    /**caochangli - 获取视频信息 */
    private getDecoderInfo() {
        try {
            let json = this.callVideoHelper("getDecoderInfo");
            if (!json) {
                console.warn("[QG-Video-Bridge] decoder not bound", this._videoID);
                return;
            }
            let info = JSON.parse(json);
            if (info.duration > 0)
                this._duration = info.duration / 1000;
        }
        catch (e) { }
    }

    /**调用native方法 - 目前仅处理了安卓 */
    private callVideoHelper(method:string,param:any = null) {
        if (!Browser.onAndroid) return null;
        if (!method || !this._videoID) return null;
        if (!param) param = {};
        param.id = this._videoID;
        return NativeVideoProxy.callVideoHelper(method,param);
    }

    /**native回调 */
    handleEvent(ret:number, msg:any) {                     
        if (this._destroyed)
            return;
        switch (ret) {
            case 4000: //视频元数据已加载 (此时已知视频宽高、总时长)
                break;
            case 4001: //播放结束
                break;
            case 4002: //播放错误
                this.event("error",msg);
                break;
            case 4003: //首帧已渲染
                break;
        }
    }

    protected onPlay(): void {
        //@ts-ignore
        this.decoder.wait(false);
    }

    protected onPause(): void {
        //@ts-ignore
        this.decoder.wait(true);
    }

    protected onStop(): void {
        this.decoder.stop();
    }
    onRender(): boolean {
        if (this._texture)
            LayaGL.textureContext.setTextureImageData(this._texture, this.decoder, false, false);
        return true;
    }
    protected onDestroy(): void {
        this.decoder.remove();//caochangli - 备注：安卓上remove只是C++层把视频干掉了，但LayaVideoDecoder.java对象并没有销毁
        if (this._videoID) {
            this.callVideoHelper("destroyDecoder");//caochangli - 销毁LayaVideoDecoder.java对象
            NativeVideoProxy.removeVideoEvent(this._videoID);
            this._videoID = null;
        }
    }
}