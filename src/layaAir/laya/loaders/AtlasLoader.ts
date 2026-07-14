import { IResourceLoader, ILoadTask, Loader } from "../net/Loader";
import { AtlasResource } from "../resource/AtlasResource";
import { Texture } from "../resource/Texture";
import { Utils } from "../utils/Utils";
import { URL } from "../net/URL";
import { ArrayPool } from "../sgsExpand/pool/ArrayPool";

class AtlasLoader implements IResourceLoader {
    load(task: ILoadTask) {
        return task.loader.fetch(task.url, "json", task.progress.createCallback(0.2), task.options, task).then(data => {
            if (!data)
                return null;

            let toloadPics: Array<Promise<Texture>> = [];
            if (data.meta && data.meta.image) {
                let folderPath: string = "";
                let i = task.url.lastIndexOf("/");
                if (i != -1)
                    folderPath = task.url.substring(0, i + 1);

                //如果图集带了版本号，需要将图集中包含的图片也需要追加版本号，以此解决浏览器缓存的问题
                let query: string = "";
                i = task.url.lastIndexOf("?");
                if (i != -1)
                    query = task.url.substring(i);

                //带图片信息的类型
                let pics: Array<string> = data.meta.image.split(",");
                for (let pic of pics) {
                    if (!pic.startsWith("res://"))
                        pic = folderPath + pic + query;
                    toloadPics.push(task.loader.load(pic, null, task.progress.createCallback()));
                }
            } else {  //不带图片信息
                toloadPics.push(task.loader.load(Utils.replaceFileExtension(task.url, "png"), null, task.progress.createCallback()));
            }

            return Promise.all(toloadPics).then(pics => {
                pics = pics.filter(pic => pic != null);
                let baseUrl = task.options.baseUrl || "";

                let frames: any = data.frames;
                let directory: string = (data.meta && data.meta.prefix != null) ? data.meta.prefix : task.url.substring(0, task.url.lastIndexOf(".")) + "/";
                let subTextures: Array<Texture> = [];

                // caochangli - 图集的散图都是相同前缀，这里做个优化减少URL.formatURL调用
                let jumpFormatURL:boolean = false;
                let atlasPrefix:string;
                let urlInfo:{typeId:number,main:boolean};
                if (!baseUrl && (!data.meta || !data.meta.prefix)) {
                    // task.url = "res/atlas/login/loginFormal.atlas";
                    // task.formattedUrl = "https://xclient.sanguosha.com/res/atlas/login/loginFormal-*****.atlas";
                    
                    let atlasDir = task.url.substring(0,task.url.lastIndexOf("/") + 1);//res/atlas/login/
                    atlasPrefix = task.formattedUrl.substring(0,task.formattedUrl.indexOf(atlasDir));//https://xclient.sanguosha.com/
                    let extEntry = Loader.extMap["png"];
                    urlInfo = {typeId:extEntry[0].typeId,main:true};
                    jumpFormatURL = true;
                }
                let frameURLs:Array<{url:string,formattedUrl:string}> = <AtlasResource>task.obsoluteInst ? ArrayPool.Get() : null;

                let scaleRate: number = 1;
                if (data.meta && data.meta.scale && data.meta.scale != 1)
                    scaleRate = parseFloat(data.meta.scale);

                for (let tPic of pics)
                    tPic.scaleRate = scaleRate;

                for (let name in frames) {
                    let obj = frames[name];
                    let tPic = pics[obj.frame.idx ? obj.frame.idx : 0];
                    if (!tPic)
                        continue;

                    let url = baseUrl + directory + (obj.filename || name);
                    let tt = Texture.create(tPic, obj.frame.x, obj.frame.y, obj.frame.w, obj.frame.h, obj.spriteSourceSize.x, obj.spriteSourceSize.y, obj.sourceSize.w, obj.sourceSize.h, obj.rotated);
                    tt._sizeGrid = obj.sizeGrid;
                    tt._stateNum = obj.stateNum;
                    if (!jumpFormatURL)
                        task.loader.cacheRes(url, tt);
                    else if (urlInfo.typeId) {//caochangli - 跳过loader.cacheRes中URL.formatURL和Loader.getURLInfo
                        let formattedUrl = atlasPrefix ? atlasPrefix + url : url;
                        Loader._cacheRes(formattedUrl, tt, urlInfo.typeId, urlInfo.main);
                        //caochangli - 缓存图集散图url
                        if (frameURLs)
                            frameURLs.push({url:url,formattedUrl:formattedUrl});
                        else
                            URL.addAtlasFrameURLCache(url,formattedUrl);
                    }
                    tt.url = url;
                    subTextures.push(tt);
                }

                let res = <AtlasResource>task.obsoluteInst;
                if (res) {
                    res.update(pics, subTextures);
                    res.dir = directory;
                    res.animation = data.animation;
                    res.event("reload");
                    //caochangli - 缓存图集散图url
                    if (frameURLs) {
                        for (let i = 0,len = frameURLs.length; i < len; i++) {
                            let frameURL = frameURLs[i];
                            URL.addAtlasFrameURLCache(frameURL.url,frameURL.formattedUrl);
                        }
                        ArrayPool.Release(frameURLs);
                    }
                    return res;
                }
                else {
                    res = new AtlasResource(directory, pics, subTextures);
                    res.animation = data.animation;
                    return res;
                }
            });
        });
    }
}

Loader.registerLoader(["atlas"], AtlasLoader, Loader.ATLAS, true);