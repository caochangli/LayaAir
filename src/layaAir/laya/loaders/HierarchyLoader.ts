import { LayaEnv } from "../../LayaEnv";
import { IResourceLoader, ILoadTask, Loader, ILoadOptions, ILoadURL } from "../net/Loader";
import { URL } from "../net/URL";
import { AssetDb } from "../resource/AssetDb";
import { Prefab } from "../resource/HierarchyResource";
import { IHierarchyParserAPI, PrefabImpl } from "../resource/PrefabImpl";
import { AssetSystem } from "../sgsExpand/loader/AssetSystem";
import { ArrayPool } from "../sgsExpand/pool/ArrayPool";

export class HierarchyLoader implements IResourceLoader {

    load(task: ILoadTask) {
        let url = task.url;
        let fromDCC = task.ext == "gltf" || task.ext == "fbx" || task.ext == "glb" || task.ext == "obj";
        if (fromDCC)
            url = AssetDb.inst.getSubAssetURL(url, task.uuid, "0", "lh");
        return task.loader.fetch(url, "json", task.progress.createCallback(0.2), task.options, !fromDCC ? task : null).then(data => {
            if (!data)
                return null;

            if (data._$ver != null)
                return this._load(PrefabImpl.v3, task, data, fromDCC);
            else if (task.ext == "ls" || task.ext == "lh")
                return this._load(PrefabImpl.v2, task, data, fromDCC);
            else if (task.ext == "scene" || task.ext == "prefab")
                return this._load(PrefabImpl.legacySceneOrPrefab, task, data, fromDCC);
            else
                return null;
        });
    }

    protected _load(api: IHierarchyParserAPI, task: ILoadTask, data: any, fromDCC: boolean): Promise<Prefab> {
        let basePath = URL.getPath(task.url);
        let links = api.collectResourceLinks(data, basePath);
        let options: ILoadOptions = Object.assign({}, task.options);
        options.initiator = task;
        delete options.cache;
        delete options.ignoreCache;
        //caochangli - 注释：处理提前+引用计数
        // return task.loader.load(links, options, task.progress.createCallback()).then((resArray: any[]) => {
        //     let res = new PrefabImpl(api, data);
        //     res.fromDCC = fromDCC;
        //     res.onLoad();
        //     res.addDeps(resArray);
        //     return res;
        // });

        //caochangli - 先把引用计数加上(防止加载过程中被回收)
        let assetSystem = AssetSystem.Ins;
        let earlyList: Array<string> | undefined;        
        if (assetSystem && links && links.length > 0)
        {
            earlyList = ArrayPool.Get();
            let link:string | ILoadURL;
            let loadPath:string;
            //预览环境 - 将uuid转路径
            if (LayaEnv.isPreview)
            {
                let promises: Promise<void>[] = [];
                for (let i = 0,length = links.length; i < length; i++)
                {
                    link = links[i];
                    if (!link) continue;
                    loadPath = typeof link == "string" ? link : link.url;
                    if (!loadPath) continue;

                    promises.push(new Promise<void>((resolve) => {
                        AssetDb.inst.uuidToUrl(loadPath, (uuid: string, url: string) => {
                            assetSystem.AddReference(url);
                            earlyList.push(url);
                            resolve();
                        });
                    }));
                }

                return Promise.all(promises).then(() => {
                    return this._load2(api,task,data,fromDCC,links,options,earlyList);
                })
            }

            //发布环境
            for (let i = 0,length = links.length; i < length; i++)
            {
                link = links[i];
                if (!link) continue;
                loadPath = typeof link == "string" ? link : link.url;
                if (!loadPath) continue;
                assetSystem.AddReference(loadPath);
                earlyList.push(loadPath);
            }
        }
        //caochangli - 先把引用计数加上(防止加载过程中被回收)

        return this._load2(api,task,data,fromDCC,links,options,earlyList);
    }

    private _load2(api:IHierarchyParserAPI,task:ILoadTask,data:any,fromDCC:boolean,links:Array<string | ILoadURL>,options:ILoadOptions,earlyList?:Array<string>):Promise<Prefab>
    {
        return task.loader.load(links, options, task.progress.createCallback()).then((resArray: any[]) => {
            let res = new PrefabImpl(api, data);
            res.fromDCC = fromDCC;
            res.onLoad();
            res.addDeps(resArray);

            //caochangli - 把先加上的计数减掉(res.addDeps会加上)
            if (earlyList && earlyList.length > 0)
            {
                let assetSystem = AssetSystem.Ins;
                for (let i = 0,length = earlyList.length; i < length; i++)
                {
                    assetSystem.DelReference(earlyList[i]);
                }
                ArrayPool.Release(earlyList);
                earlyList = null;
            }
            //caochangli - 把先加上的计数减掉(res.addDeps会加上)

            return res;
        });
    }
}

Loader.registerLoader(["lh", "ls", "scene", "prefab"], HierarchyLoader, Loader.HIERARCHY);