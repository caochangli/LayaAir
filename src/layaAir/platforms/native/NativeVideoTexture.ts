import { LayaGL } from "../../laya/layagl/LayaGL";
import { VideoTexture } from "../../laya/media/VideoTexture";
import { URL } from "../../laya/net/URL";
import { PAL } from "../../laya/platform/PlatformAdapters";
import { Browser } from "../../laya/utils/Browser";

export class NativeVideoTexture extends VideoTexture {
    readonly decoder: any;

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
        });
        this.decoder.on("ended", () => {
            if (this._loop)
                this.decoder.stop().then(() => this.decoder.start(this._startOption));
            else {
                this._ended = true;
                this.event("ended");
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

        this._startOption = {};
        this._startOption.source = url;//URL.postFormatURL(URL.formatURL(url));
        if (Browser.isIOSHighPerformanceModePlus)
            this._startOption.videoDataType = 2;

        this.decoder.start(this._startOption).then((res: any) => {
            this.setLoaded(res.width, res.height, true);
            if (!this._playing)
                this._waitFirstFrame = true;
        }).catch((err: any) => {
            console.warn("MgVideoTexture: " + err.message);
        });
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
        this.decoder.remove();
    }
}