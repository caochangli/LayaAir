import { IVideoPlayerOptions } from "../../laya/media/VideoPlayerBackend";
import { Browser } from "../../laya/utils/Browser";

// var videoEventRegistered = false;
// var videoIdSeed = 0;
// const videoProxyMap = new Map();

// const QG_VIDEO_HELPER_CLASS = "com.yoka.dgxj.libs.QGVideoHelper";

// /** 视频桥统一入口：返回值为被调方法的结果（create/getInfo 返回字符串，void 返回 ""） */
// function callVideoHelper(method:string, param:any) {
//     return (Browser.window as any).conch.postSyncMessage(method, JSON.stringify({
//         className: QG_VIDEO_HELPER_CLASS,
//         args: [JSON.stringify(param)]
//     }));
// }

// function fitStrToInt(fit:string) {
//     if (fit === "fill")
//         return 0;
//     if (fit === "cover")
//         return 2;
//     return 1;
// }

// function createVideoID() {
//     return "video_" + (++videoIdSeed);
// }

// /** 注册 QGVideoHelper.onVideoEvent 回调（CallBackToJS 按 类名+方法名 匹配） */
// function registerVideoBridge() {
//     if (!videoEventRegistered) {
//         let cls = (Browser.window as any).PlatformClass.createClass(QG_VIDEO_HELPER_CLASS);
//         cls.callWithBack(dispatchVideoEvent, "onVideoEvent");
//         videoEventRegistered = true;
//     }
//     return true;
// }

// function dispatchVideoEvent(json:string) {
//     try {
//         let info = JSON.parse(json || "{}");
//         if (info.name !== QG_VIDEO_HELPER_CLASS)
//             return;
//         let msg = JSON.parse(info.msg || "{}");
//         let proxy = videoProxyMap.get(msg.id);
//         if (proxy)
//             proxy.handleEvent(info.ret, msg);
//     }
//     catch (e) {
//         console.error("[QG-Video-Bridge] dispatchVideoEvent error", e, json);
//     }
// }

/**
 * native视频播放代理类
 */
export class NativeVideoProxy {

//静态方法-------------------
    private static videoEventRegistered = false;
    private static videoIdSeed = 0;
    private static videoProxyMap = new Map();

    static VIDEO_HELPER_CLASS = "com.yoka.dgxj.libs.QGVideoHelper";

    /**创建桥接视频ID */
    static createVideoID() {
        return "video_" + (++this.videoIdSeed);
    }

    /** 视频桥接接口：js -> native */
    static callVideoHelper(method:string, param:any) {
        return (Browser.window as any).conch.postSyncMessage(method, JSON.stringify({
            className: this.VIDEO_HELPER_CLASS,
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
            let cls = (Browser.window as any).PlatformClass.createClass(this.VIDEO_HELPER_CLASS);
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
            if (info.name !== NativeVideoProxy.VIDEO_HELPER_CLASS)
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
        if (!src.includes("[dccLocalPath]")) {//远程目录，拼接上url前缀
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
        return videoInfo ? videoInfo.current / 1000 : 0;
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
    handleEvent(ret:number, msg:any) {
        if (!this._owner)
            return;
        switch (ret) {
            case 4000: //视频元数据已加载 (此时已知视频宽高、总时长)
                if (this._onReady)
                    this._onReady();
                break;
            case 4001: //播放结束
                if (this._onEnded)
                    this._onEnded();
                break;
            case 4002: //播放错误
                if (this._onError)
                    this._onError(msg);
                break;
            case 4003: //首帧已渲染
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