import { Mutable } from "../../ILaya";
import { VideoPlayerBackend } from "../../laya/media/VideoPlayerBackend";
import { URL } from "../../laya/net/URL";
import { PAL } from "../../laya/platform/PlatformAdapters";
import { Browser } from "../../laya/utils/Browser";
import { getErrorMsg } from "../../laya/utils/Error";
import { NativeVideoProxy } from "./NativeVideoProxy";

/**
 * caochangli - 备注：Laya原始缺少下列功能
 * 缺少功能接口，如：duration、volume
 * 缺少事件通知，如：loadedmetadata、ended、error
 * 对缺少的功能采用扩展桥接的方式实现了(目前仅实现了安卓)
 * 
 * 同时自定义了一套原生视频播放方式(通过NativeVideoProxy桥接，目前仅实现了安卓)
 */
export class NativeVideoPlayer extends VideoPlayerBackend {
    readonly video: any;

    private _loop: boolean = false;
    private _ended: boolean = false;
    private _muted: boolean = false;
    private _volume: number = 1;
    private _playbackRate: number = 1;

    //caochangli - 补充接口
    private _videoID:string;
    private _duration:number = 0;
    private _isCustomVideo:boolean;
    //caochangli - 补充接口

    get loop(): boolean {
        return this._loop;
    }

    set loop(value: boolean) {
        this._loop = value;
        if (this.video)
            this.video.loop = value;
    }

    get ended(): boolean {
        return this._ended;
    }

    get currentTime(): number {
        if (this.video)
            return this.video.tell();
        return 0.0;
    }

    set currentTime(value: number) {
        if (this.video)
            this.video.seek(value * 1000);
    }

    //caochangli - 补充接口(目前仅安卓支持了)
    get duration(): number {
        if (this._isCustomVideo) {
            if (this.video)
                return this.video.duration;
        }
        return this._duration;
    }

    get muted(): boolean {
        return this._muted;
    }

    set muted(value: boolean) {
        this._muted = value;
        if (this.video)
            this.video.muted = value;
    }

    //caochangli - 补充接口(目前仅安卓支持了)
    get volume() {
        return this._volume;
    }
    set volume(value:number) {
        this._volume = value;
        if (this._isCustomVideo) {
            if (this.video)
                this.video.volume = value;
        }
        else
            this.callVideoHelper("setPlayerParam",{volume:value});
    }

    get playbackRate(): number {
        return this._playbackRate;
    }

    set playbackRate(value: number) {
        this._playbackRate = value;
        if (this.video)
            this.video.playbackRate = value;
    }
    
    // caochangli - native环境下视频播放 - 先dcc下载到本地，再将本地路径传给native
    protected onLoad(url: string): void {
        this._ended = false;
        if (this._loaded) {
            this._loaded = false;
            this.video.destroy();
        }
        
        let src = URL.postFormatURL(URL.formatURL(url));
        let dccClient = (window as any).dcc;
        if (!src || !dccClient || src.startsWith("https://") || src.startsWith("http://"))
        {
            this.onLoad1(src);
            return;
        }

        // 使用dcc下载文件到本地，使用本地路径播放
        dccClient.updateFile(src).then((result:{isSucc:boolean,localPath:string}) => {
            if (this._owner && this._source === url) {
                if (result.isSucc && result.localPath)
                    this.onLoad1(NativeVideoProxy.DCC_LOCAL_PATCH_TAG + result.localPath);
                else
                    this.onLoad1(src);
            }
        }, () => {
            if (this._owner && this._source === url)
                this.onLoad1(src);
        });
    }
    protected onLoad1(url: string): void {
        // this._ended = false;
        // if (this._loaded)
        //     this.video.destroy();

        // ======自定义视频播放
        let win = Browser.window as any;
        if (Browser.onAndroid && Browser.onLayaRuntime
            && win.conch && win.conch.postSyncMessage && win.PlatformClass)
        {
            this._isCustomVideo = true;
            (<Mutable<this>>this).video = new NativeVideoProxy(this,
                this.options,
                this.getNodeTransform(),
                url,this._playing,this._loop,this._muted,this.volume,this._playbackRate);
            this.video.onEnded(() => {
                if (this._owner) {
                    this._ended = true;
                    this._owner.event("ended");
                }
            });
            this.video.onError((err: any) => {
                if (this._owner) {
                    console.error("NativeVideoPlayer: " + getErrorMsg(err));
                    this._owner.event("error",err);
                }
            });
            this.video.onReady(() => {
                if (this._owner) {
                    this.setLoaded();
                }
            });
            return;
        }

        // ======Laya官方视频播放
        // caochangli - 注册扩展事件、组装url扩展参数
        this._videoID = NativeVideoProxy.createVideoID();
        NativeVideoProxy.registerVideoEvent(this._videoID,this);
        let expand = {videoID:this._videoID,volume:this._volume};
        url += `[expand${JSON.stringify(expand)}expand]`;
        // caochangli - 注册扩展事件、组装url扩展参数

        (<Mutable<this>>this).video = PAL.g.createVideo(Object.assign({},
            this.options,
            this.getNodeTransform(),
            {
                src: url,//URL.postFormatURL(URL.formatURL(url)),
                autoplay: this._playing,
                loop: this._loop,
                muted: this._muted,
                playbackRate: this._playbackRate,
            }));
        this.video.onEnded(() => {//caochangli - 安卓没有回调，采用扩展方式实现
            if (this._owner) {
                this._ended = true;
                this._owner.event("ended");
            }
        });
        this.video.onError((err: any) => {//caochangli - 安卓没有回调，采用扩展方式实现
            if (this._owner) {
                console.error("NativeVideoPlayer: " + getErrorMsg(err));
                this._owner.event("error",err);
            }
        });

        if (!Browser.onAndroid) {//caochangli - 安卓时机不对，放到扩展事件调用
            this.setLoaded();
        }
    }

    /**caochangli - 获取视频信息 */
    private getPlayerInfo() {
        try {
            let json = this.callVideoHelper("getPlayerInfo");
            if (!json) {
                console.warn("[QG-Video-Bridge] player not bound", this._videoID);
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
        if (!Browser.onAndroid) return null;//目前仅实现了安卓
        if (!method || !this._videoID) return null;
        if (!param) param = {};
        param.id = this._videoID;
        return NativeVideoProxy.callVideoHelper(method,param);
    }
    
    /**native回调 - LayaVideoPlayer.java的扩展事件 */
    handleEvent(ret:string, msg:any) {                     
        if (!this._owner)
            return;
        switch (ret) {
            case "loadedmetadata": //视频元数据已加载 (此时已知视频宽高、总时长)
                this.getPlayerInfo();   
                this.setLoaded();
                break;
            case "canplay": //首帧已渲染
                break;
            case "ended": //播放结束
                if (this._owner) {
                    this._ended = true;
                    this._owner.event("ended");
                }
                break;
            case "error": //播放错误
                if (this._owner)
                    this._owner.event("error",msg);
                break;
        }
    }

    protected onPlay(): void {
        if (this.video)
            this.video.play();
    }

    protected onPause(): void {
        if (this.video)
            this.video.pause();
    }

    protected onTransformChanged(): void {
        if (!this.video)
            return;

        let { x, y, width, height } = this.getNodeTransform();

        if (this._isCustomVideo) {
            this.video.setRect(x,y,width,height);
        }
        else {
            this.video.x = x;
            this.video.y = y;
            this.video.width = width;
            this.video.height = height;
        }
    }

    protected onBlur() {
        // native安卓 - 前后台切换暂停、恢复视频在native层已实现
        if (!Browser.onAndroid)
            super.onBlur();
    }

    protected onDestroy(): void {
        if (this.video)
            this.video.destroy();
        if (this._videoID) {
            NativeVideoProxy.removeVideoEvent(this._videoID);
            this._videoID = null;
        }
    }
}