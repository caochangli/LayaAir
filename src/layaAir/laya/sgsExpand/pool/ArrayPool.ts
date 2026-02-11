import { ClassUtils } from "../../utils/ClassUtils";

/**桥接业务层 - ArrayPool */
export class ArrayPool
{
    public static Get():Array<any>
    {
        let clsDef = ClassUtils.getClass("ArrayPool");
        return clsDef ? clsDef.Get() : null;
    }

    public static Release(array:any[])
    {
        if (array)
        {
            let clsDef = ClassUtils.getClass("ArrayPool");
            clsDef && clsDef.Release(array);
        }
    }
}