import { ClassUtils } from "../../utils/ClassUtils";

export interface IAssetGroup 
{
    /**
     * 加载单个资源
     * @param url 资源url
     * @param type 资源类型
     * @param caller 回调作用域
     * @param onComplete 完成回调 - 不代表加载成功
     * @param args 透传参数
     * @param onProgress 进度回调
     */
    Load<T>(url:string,type?:string,caller?:any,
        onComplete?:(url:string,res:T,args?:any)=>void,args?:any,onProgress?:(url:string,progress:number)=>void):void;
    Load(url:string,type?:string,caller?:any,
        onComplete?:(url:string,res:any,args?:any)=>void,args?:any,onProgress?:(url:string,progress:number)=>void):void;

    /**
     * 加载一组资源
     * @param urls 资源urls
     * @param caller 回调作用域
     * @param onComplete 完成回调 - 不代表加载成功
     * @param args 透传参数
     * @param onProgress 进度回调
     * @return 返回groupID - -1表示无效的groupID，不需要加载直接返回
     */
    LoadGroup(urls:Array<string | {url:string,type?:string}>,caller?:any,
        onComplete?:(group:IAssetGroup,resList:Array<any>,args?:any)=>void,args?:any,onProgress?:(progress:number)=>void):number;
    
    /**
     * 通过 URL 和类型获取资源。
     * @param url 资源的 URL。
     * @param type 资源的类型。
     * @returns 资源。
     */
    GetRes<T>(url:string,type?:string):T;

    /**
     * 通过 URL 和类型获取资源。
     * @param url 资源的 URL。
     * @param type 资源的类型。
     * @returns 资源。
     */
    GetRes(url:string,type?:string):any;

    /**资源是否加载中 */
    IsResLoading(url:string):boolean;

    /**
     * 仅添加引用计数(不做加载操作)
     * @param url 资源url
     * @param res 资源
     */
    OnlyAddReference(url:string,res?:any):void

    /**
     * 取消所有的资源加载 - 移除所有未加载完的资源的回调事件
     * @param isRelease 是否同时释放资源 - false表示只是不再接收加载回调，其资源计数还在
     */
    CancelAllAssets(isRelease:boolean):void;

    /**
     * 取消单个资源加载 - 移除单个未加载完的资源的回调事件
     * @param isRelease 是否同时释放资源 - false表示只是不再接收加载回调，其资源计数还在
     */
    CancelAsset(url:string,caller:any,onComplete:(url:string,res:any,args?:any)=>void,onProgress:(url:string,progress:number)=>void,isRelease:boolean):void;
}

/**桥接业务层 - AssetGroup */
export class AssetGroup
{
    public static Get():IAssetGroup
    {
        let clsDef = ClassUtils.getClass("AssetGroup");
        return clsDef ? clsDef.Get() : null;
    }

    public static Release(group:IAssetGroup)
    {
        if (group)
        {
            let clsDef = ClassUtils.getClass("AssetGroup");
            clsDef && clsDef.Release(group);
        }
    }
}