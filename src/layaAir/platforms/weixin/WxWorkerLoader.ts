
import { WorkerLoader } from "../../laya/net/WorkerLoader";
import { Browser } from "../../laya/utils/Browser";

//caochangli - 微信worker线程(配合小游戏workers/index.js)
export class WxWorkerLoader extends WorkerLoader {

    private static customEnable:boolean = false;

    static __init() {
        Object.defineProperty(WorkerLoader, 'enable', {
            get: () => WxWorkerLoader.customEnable,
            set: (value) => {
                WxWorkerLoader.enable = value;
            },
        });
    }

    static set enable(value:boolean) {
        if (WxWorkerLoader.customEnable != value) {
            if (value) {
                if (!(Browser.window as any).wx.createWorker)
                    return;
                if (!(WorkerLoader as any)._worker) {
                    (WorkerLoader as any)._worker = (Browser.window as any).wx.createWorker('workers/index.js', {
                        useExperimentalWorker: true
                    });
                    (WorkerLoader as any)._worker.onMessage(WxWorkerLoader.wxWorkerMessage);
                    // WorkerLoader._dispatcher = new EventDispatcher();
                }
            }
            WxWorkerLoader.customEnable = value;
        }
    }

    static wxWorkerMessage(evt:any) {
        if (evt.errCode) {
            // WxWorkerLoader._dispatcher.event(evt.readyUrl, null);
            WxWorkerLoader.onCallBack(evt.readyUrl,null);
            return;
        }
        let data = evt.data;
        if (data) {
            switch (data.type) {
                case "Image":
                    let nativeImage = new Browser.window.Image();
                    nativeImage.crossOrigin = "";
                    nativeImage.src = data.imageBitmap;
                    nativeImage.onload = () => {
                        // let readyUrl = evt.readyUrl;
                        // if (evt.errCode == 0) {
                        //     var fileObj = MiniFileMgr.getFileInfo(readyUrl);
                        //     if (!fileObj) {
                        //         let tempFilePath = data.tempFilePath;
                        //         MiniFileMgr.copyTOCache(tempFilePath, readyUrl, null, "", true);
                        //     }
                        // }
                        // WxWorkerLoader._dispatcher.event(data.url, nativeImage);
                        WxWorkerLoader.onCallBack(data.url,evt.errCode == 0 ? nativeImage : null);
                    };
                    nativeImage.onerror = () => {
                        // console.log("load image failed ");
                        WxWorkerLoader.onCallBack(data.url,null);
                    };
                    break;
                case "Disable":
                    WxWorkerLoader.enable = false;
                    break;
            }
        }
    }

    static onCallBack(url:string,nativeImage:any) {
        // if (nativeImage)
        //     console.log("worker download succ url:" + url);
        // else
        //     console.warn("worker download fail url:" + url);
        let callbacks = (WxWorkerLoader as any)._queue[url];
        if (callbacks) {
            delete (WxWorkerLoader as any)._queue[url];
            for (let i = nativeImage ? 0 : 1; i < callbacks.length; i += 2) {
                callbacks[i](nativeImage);
            }
        }
    }
}
WxWorkerLoader.__init();