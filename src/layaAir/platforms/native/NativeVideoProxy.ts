import { IVideoPlayerOptions } from "../../laya/media/VideoPlayerBackend";
import { Browser } from "../../laya/utils/Browser";

/**
 * native视频播放代理类
 */
export class NativeVideoProxy {

//静态方法-------------------
    // static DCC_LOCAL_PATCH_TAG:string = "[dccLocalPath]";
    static VIDEO_ANDROID_CLASS = "com.yoka.dgxj.libs.QGVideoHelper";
    static VIDEO_HARMONRY_CLASS = "Harmonry.VideoPlayer";

    private static videoEventRegistered:boolean = false;
    private static videoIdSeed:number = 0;
    private static videoProxyMap = new Map();

    /**获取视频桥接类 */
    static get videoClass():string {
        if (Browser.onAndroid)
            return this.VIDEO_ANDROID_CLASS;
        if (Browser.onOpenHarmonyOS)
            return this.VIDEO_HARMONRY_CLASS;
        return "";
    }

    /**创建桥接视频ID */
    static createVideoID() {
        return "video_" + (++this.videoIdSeed);
    }

    /** 视频桥接接口：js -> native */
    static callVideoHelper(method:string, param:any) {
        return (Browser.window as any).conch.postSyncMessage(method, JSON.stringify({
            className: this.videoClass,
            args: [JSON.stringify(param)]
        }));
    }

    /**
     * 注册视频native层扩展事件 - 用于接收native层扩展事件通知到js层时，分发到代理对象(handleEvent)
     * @param videoID 视频ID
     * @param obj 代理对象
     */
    static registerVideoEvent(videoID:string,obj:any) {
        this.videoProxyMap.set(videoID,obj);
        if (!this.videoEventRegistered) {
            let cls = (Browser.window as any).PlatformClass.createClass(this.videoClass);
            cls.callWithBack(this.dispatchVideoEvent, "onVideoEvent");
            this.videoEventRegistered = true;
        }
        return true;
    }

    /**
     * 删除注册的视频native层扩展事件
     * @param videoID 视频ID
     */
    static removeVideoEvent(videoID:string) {
        this.videoProxyMap.delete(videoID);
    }

    /**接收分发native层视频事件 */
    static dispatchVideoEvent(json:string) {
        try {
            let info = JSON.parse(json || "{}");
            if (info.name !== NativeVideoProxy.videoClass)
                return;
            let msg = JSON.parse(info.msg || "{}");
            let proxy = NativeVideoProxy.videoProxyMap.get(msg.id);
            if (proxy && proxy.handleEvent)
                proxy.handleEvent(info.ret, msg);
        }
        catch (e) {
            console.error("[Video-Bridge] dispatchVideoEvent error", e, json);
        }
    }
//静态方法-------------------

    
    private _videoID:string;
    private _owner:any;
    private _duration:number = 0;
    private _onEnded:Function;
    private _onError:Function;
    private _onReady:Function;

    constructor(owner:any,options:IVideoPlayerOptions,
        trans:{x:number,y:number, width:number, height:number},
        src:string,autoplay:boolean,loop:boolean,muted:boolean,volume:number,playbackRate:number) {
        
        this._videoID = NativeVideoProxy.createVideoID();
        this._owner = owner;

        // 远程资源 - 拼接上dcc url前缀
        if (!src.startsWith("https://") && !src.startsWith("http://") && !src.startsWith("file:")) {
            let dccClient = (window as any).dcc;
            if (dccClient && dccClient._pathMapToDCC)
                src = dccClient._pathMapToDCC + src;
        }
            
        NativeVideoProxy.registerVideoEvent(this._videoID,this);
        this.callVideoHelper("create", {
            x: Math.round(trans.x),
            y: Math.round(trans.y),
            w: Math.max(1, Math.round(trans.width)),
            h: Math.max(1, Math.round(trans.height)),
            objectFit: this.fitStrToInt(options.objectFit),
            controls: !!options.controls,
            underGameView: !!options.underGameView,
            url: src,
            autoplay: autoplay,
            loop: loop,
            muted: muted,
            volume: volume,
            rate: playbackRate
        });
    }

    private fitStrToInt(fit:string) {
        if (fit === "fill")
            return 0;
        if (fit === "cover")
            return 2;
        return 1;
    }

    onEnded(callback:Function) { 
        this._onEnded = callback;
    }
    
    onError(callback:Function) { 
        this._onError = callback; 
    }

    onReady(callback:Function) { 
        this._onReady = callback;
    }

    set loop(value:boolean) {
        this.callVideoHelper("setLoop",{value:value});
    }

    set muted(value:boolean) {
        this.callVideoHelper("setMuted",{value:value});
    }

    set volume(value:number) {
        this.callVideoHelper("setVolume",{value:value});
    }

    set playbackRate(value:boolean) {
        this.callVideoHelper("setRate",{value:value});
    }

    setRect(x:number, y:number, width:number, height:number) {
        this.callVideoHelper("setRect",{x:Math.round(x),y:Math.round(y),w:Math.max(1, Math.round(width)),h:Math.max(1, Math.round(height))});
    }

    tell():number {
        return this.currentTime;
    }

    seek(ms:number) { 
        this.callVideoHelper("seek",{ms:Math.round(ms)}); 
    }

    durationOffest(ms:number) { 
        this.callVideoHelper("durationOffest",{ms:Math.round(ms)}); 
    }

    play() { 
        this.callVideoHelper("play");
    }

    pause() { 
        this.callVideoHelper("pause"); 
    }

    stop() { 
        this.callVideoHelper("stop");
    }

    get currentTime() {
        let videoInfo = this.getPlayerInfo();
        return videoInfo ? videoInfo.current / 1000 : 0.0;
    }

    get duration() {
        if (!this._duration)
            this.getPlayerInfo();
        return this._duration;
    }

    /**caochangli - 获取视频信息 */
    getPlayerInfo() {
        let json = this.callVideoHelper("getInfo");
        if (!json)
            return null;
        try {
            let info = JSON.parse(json || "{}");
            if (info.duration > 0)
                this._duration = info.duration / 1000;
            return info;
        }
        catch (e) {
            return null;
        }
    }

    /**调用native方法 - 目前仅处理了安卓 */
    private callVideoHelper(method:string,param:any = null) {
        if (!Browser.onAndroid) return;
        if (!method || !this._videoID) return;
        if (!param) param = {};
        param.id = this._videoID;
        return NativeVideoProxy.callVideoHelper(method,param);
    }

    /**native回调 */
    handleEvent(ret:string, msg:any) {
        if (!this._owner)
            return;
        switch (ret) {
            case "loadedmetadata": //视频元数据已加载 (此时已知视频宽高、总时长)
                if (this._onReady)
                    this._onReady();
                break;
            case "canplay": //首帧已渲染
                break;
            case "ended": //播放结束
                if (this._onEnded)
                    this._onEnded();
                break;
            case "error": //播放错误
                if (this._onError)
                    this._onError(msg);
                break;
        }
    }

    destroy() {
        if (this._videoID)
        {
            this.callVideoHelper("destroy");
            NativeVideoProxy.removeVideoEvent(this._videoID);
            this._videoID = null;
        }
        this._owner = null;
        this._onEnded = null;
        this._onError = null;
        this._onReady = null;
    }
}