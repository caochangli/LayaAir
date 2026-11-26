import { Mutable } from "../../ILaya";
import { VideoPlayerBackend } from "../../laya/media/VideoPlayerBackend";
import { URL } from "../../laya/net/URL";
import { PAL } from "../../laya/platform/PlatformAdapters";
import { Browser } from "../../laya/utils/Browser";
import { getErrorMsg } from "../../laya/utils/Error";
import { NativeVideoProxy } from "./NativeVideoProxy";

/**
 * caochangli - 备注：Laya原始缺少一系列功能和事件
 * - 缺少功能，如：duration、volume、在游戏下层
 * - 缺少事件，如：loadedmetadata、ended、error
 * 
 * 解决方案：
 * - 安卓：扩展LayaVideoPlayer.java类再通过自定义桥补齐功能(不支持在游戏下层)，同时又写了一套原生播放器方式(NativeVideoProxy->QGVideoView.java)
 * - 鸿蒙：扩展VideoPlay.ets类再通过自定义桥补齐功能(duration、在游戏下层、loadedmetadata、ended、error)
 * - IOS：官方Native在C++中无法扩展，又写一套原生播放器方式(NativeVideoProxy->QGVideoView.mm)
 */
export class NativeVideoPlayer extends VideoPlayerBackend {
    readonly video: any;

    private _loop: boolean = false;
    private _ended: boolean = false;
    private _muted: boolean = false;
    private _volume: number = 1;
    private _playbackRate: number = 1;

    //caochangli - 补充接口
    private _duration: number = 0;
    //caochangli - 补充接口

    private _videoID: string;//自定义使用ID
    private _useLayaNativePlayer: boolean = false;//强制使用官方视频播放功能
    private _isCustomVideo: boolean;//使用的是否是自定义播放功能(目前仅对安卓、IOS又写了一套播放功能)

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
        {
            // caochangli - 鸿蒙：使用自定义桥getPlayerInfo功能补充
            if (Browser.onOpenHarmonyOS) {
                let info = this.getPlayerInfo();
                return info && info.currentTime ? info.currentTime / 1000 : 0.0;
            }
            // 安卓&IOS - LayaVideoPlayer.java、IOS官方C++、NativeVideoProxy.ts(QGVideoHelper.java、QGVideoHelper.mm)
            return this.video.tell();
        }
        return 0.0;
    }

    set currentTime(value: number) {
        if (this.video)
            this.video.seek(value * 1000);
    }

    // caochangli - 补充功能
    // 安卓 - LayaVideoPlayer.java 通过自定义桥getPlayerInfo补充
    // 安卓 - QGVideoView.java 自定义视频播放功能支持
    // 鸿蒙 - VideoPlayer.ets 通过自定义桥getPlayerInfo补充
    // IOS - 官方C++无法扩展，QGVideoHelper.mm自定义视频播放功能支持
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

    //caochangli - 备注：
    // 安卓 - LayaVideoPlayer.java 通过自定义桥补充
    // 安卓 - QGVideoView.java 自定义视频播放功能支持
    // 鸿蒙 - 没有音量设置功能
    // IOS -  官方C++无法扩展，QGVideoHelper.mm自定义视频播放功能支持
    get volume() {
        return this._volume;
    }
    set volume(value:number) {
        this._volume = value;
        if (!this.video) return;
        if (Browser.onOpenHarmonyOS) return;// 鸿蒙没有音量设置功能
        if (this._isCustomVideo)
            this.video.volume = value;
        else if (Browser.onAndroid)
            this.callVideoHelper("setPlayerParam",{volume:value});
        else
            this.video.volume = value;
    }

    //caochangli - 备注：
    // 安卓 - LayaVideoPlayer.java、QGVideoView.java 均支持
    // 鸿蒙 - 只支持 0.75 / 1.0 / 1.25 / 1.75 / 2.0
    // IOS -  官方C++(当前这次有效，循环播放后续次会恢复)、QGVideoHelper.mm 均支持
    get playbackRate(): number {
        return this._playbackRate;
    }
    set playbackRate(value: number) {
        this._playbackRate = value;
        if (this.video) {
            // 鸿蒙 - 入参是挡位式的，C++侧直接没实现这个接口(通过自定义桥实现，Native层已做挡位就近保护)
            if (Browser.onOpenHarmonyOS)
                this.callVideoHelper("setPlaybackRate", { rate: value });
            else
                this.video.playbackRate = value;
        }       
    }

    /** caochangli - 安卓&IOS Native播放器模式自己实现了一套，默认使用自己实现的一套，若要使用Laya官方的通过此接口设置 */
    get useLayaNativePlayer(): boolean {
        return this._useLayaNativePlayer;
    }
    set useLayaNativePlayer(value: boolean) {
        this._useLayaNativePlayer = value;
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
        dccClient.updateFile(src,Browser.onIOS).then((result:{isSucc:boolean,localPath:string}) => {
            if (this._owner && this._source === url) {
                if (result.isSucc && result.localPath) {
                    // C++桥会给非http开头的url拼接上dcc前缀：
                    // 如 res/video/test.mp4 经C++拼接 https://projectq-client.sanguosha.com/dev_month/res/video/test.mp4
                    // 而本地路径非http开头，被拼上http后，变成到远程去下载了 - 需要做处理绕过C++拼前缀，又要native真正读取本地文件播放
                    if (Browser.onAndroid)
                        this.onLoad1("file://" + result.localPath);
                    // 鸿蒙 - 在videoPlayer.ets setURL方法中对url做了反向解析(去掉file:// 再getUriFromPath)
                    else if (Browser.onOpenHarmonyOS)
                        this.onLoad1("file://" + result.localPath);
                    // ios - 既要绕过C++拼dcc前缀，又要文件带后缀 (如：.mp4)C++中写死了只有这个前缀的才走到layadcc._jsdown方法中，再在_jsdown中将http://stand.alone.version/换成dcc前缀读取本地文件(拷贝一份文件)
                    //       采用从本地拷贝一份镜像文件，镜像文件名带上后缀，把镜像文件地址传给C++，使用镜像文件播放
                    else if (Browser.onIOS)
                        // this.onLoad1("http://stand.alone.version/" + src);
                        this.onLoad1("file://" + result.localPath);
                    else
                        this.onLoad1("file://" + result.localPath);
                }
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

        // ======================= 自定义视频播放(安卓、ios) =======================
        let win = Browser.window as any;
        if (!this._useLayaNativePlayer && (Browser.onAndroid || Browser.onIOS) && 
            Browser.onLayaRuntime && win.conch && win.conch.postSyncMessage && win.PlatformClass)
        {
            this._isCustomVideo = true;
            (<Mutable<this>>this).video = new NativeVideoProxy(this,
                this.options,
                this.getNodeTransform(),
                url,this._playing,this._loop,this._muted,this.volume,this._playbackRate);
            this.video.onEnded(() => {
                if (!this._owner || this._loop) return;
                this._ended = true;
                this.setEnded();
                this._owner.event("ended");
            });
            this.video.onError((err: any) => {
                if (!this._owner) return;
                console.error("NativeVideoPlayer: " + getErrorMsg(err));
                this._owner.event("error",err);
            });
            this.video.onReady(() => {
                if (!this._owner) return;
                this.setLoaded();
            });
            return;
        }

        // ======================= Laya官方视频播放 =======================
        // 安卓&鸿蒙 - 通过自定义桥补充缺失功能
        // IOS - Native代码在C++中无法扩展

        // caochangli - 注册扩展事件、组装url扩展参数
        if (Browser.onAndroid || Browser.onOpenHarmonyOS) {//ios-Native代码在C++中
            this._videoID = NativeVideoProxy.createVideoID();
            NativeVideoProxy.registerVideoEvent(this._videoID,this);
            let expand:any = {videoID:this._videoID,volume:this._volume};
            if (Browser.onOpenHarmonyOS)//鸿蒙 - 带上是否显示在游戏画布之下
                expand.underGameView = !!this.options.underGameView;
            url += `[expand${JSON.stringify(expand)}expand]`;
        }
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

        // caochangli - 安卓&鸿蒙&ios ended、error事件收不到，其中安卓&鸿蒙通用自定义桥补充功能(在自定义桥的loadedmetadata事件中执行setLoaded)
        //              而IOS源码在C++中无法扩展
        if (!Browser.onAndroid && !Browser.onOpenHarmonyOS && !Browser.onIOS) {
            this.video.onEnded(() => {
                if (!this._owner || this._loop) return;
                this._ended = true;
                this.setEnded();
                this._owner.event("ended");
                
            });
            this.video.onError((err: any) => {
                if (!this._owner) return;
                console.error("NativeVideoPlayer: " + getErrorMsg(err));
                this._owner.event("error",err);
            });
            this.setLoaded();
        }
        
        if (Browser.onIOS)//ios 收不到loadedmetadata事件，只能直接设置加载完成
            this.setLoaded();
    }

    /**caochangli - 获取视频信息(安卓&鸿蒙Laya官方视频功能调用) */
    private getPlayerInfo():Record<string,any> {
        try {
            let json = this.callVideoHelper("getPlayerInfo");
            if (!json) {
                console.warn("[QG-Video-Bridge] player not bound", this._videoID);
                return null;
            }
            let info = JSON.parse(json);
            if (info.duration > 0)
                this._duration = info.duration / 1000;
            return info;
        }
        catch (e) { }
        return null;
    }

    /**调用native方法 - 安卓&鸿蒙 */
    private callVideoHelper(method:string,param:any = null) {
        if (Browser.onAndroid || Browser.onOpenHarmonyOS) {
            if (!method || !this._videoID) return null;
            if (!param) param = {};
            param.id = this._videoID;
            return NativeVideoProxy.callVideoHelper(method,param);
        }
        return null;
    }
    
    /**native回调 - LayaVideoPlayer.java、VideoPlayer.ets的扩展事件 */
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
                if (this._owner && !this._loop) {
                    this._ended = true;
                    this.setEnded();
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
        if (this.video) {
            this._ended = false;
            this.video.play();
        }       
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

    // caochangli - 重写方法
    protected setLoaded() {
        super.setLoaded();

        // 解决：先autoPlay=true，然后在视频元未加载好前又pause(因_loaded=false未透传给native层，native层还是自动播放了)
        if (!this._playing)
            this.onPause();
    }
    
    // caochangli - 重写方法
    protected onBlur() {
        // 安卓：前后台切换暂停、恢复视频在native层已实现
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