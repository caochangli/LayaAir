import { ClassUtils } from "../../utils/ClassUtils";

export interface IAssetSystem 
{
    /**获取资源引用计数 */
    GetReference(url:string):number;

    /**添加资源引用计数 */
    AddReference(url:string):number;

    /**删除资源引用计数 - 当计数为0时，自动清理资源*/
    DelReference(url:string,count?:number):number
}

/**桥接业务层 - AssetSystem */
export class AssetSystem
{
    public static get Ins():IAssetSystem
    {
        let clsDef = ClassUtils.getClass("AssetSystem");
        return clsDef ? clsDef.Ins : null;
    }
}