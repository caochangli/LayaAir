import { ILaya } from "../../ILaya";
import { LayaEnv } from "../../LayaEnv";
import { Utils } from "../utils/Utils";
import { Texture } from "./Texture";
/**
 * @en This class is used to describe resources.
 * @zh 此类用来描述资源
 */
export class AssetDb {
    /**
     * @en Default resource instance.
     * @zh 默认资源实例。
     */
    static inst: AssetDb = new AssetDb();

    /**
     * @en UUID data.
     * @zh UUID 数据。
     */
    uuidMap: Record<string, string> = {};

    /**
     * @en Shader name data.
     * @zh 着色器名称数据。
     */
    shaderNameMap: Record<string, string> = {};

    /**
     * @en Metadata for resources.
     * @zh 资源的元数据。
     */
    metaMap: Record<string, any> = {};

    /**
     * @en I18n URL map.
     * @zh I18n URL 映射。
     */
    i18nUrlMap: Record<string, string> = {};

    /**
     * @en Gets the URL from the UUID.
     * @param uuid The UUID.
     * @returns The URL corresponding to the UUID.
     * @zh 根据 UUID 获取 URL。
     * @param uuid UUID
     * @returns UUID 对应的 URL
     */
    UUID_to_URL(uuid: string): string {
        return this.uuidMap[uuid];
    }

    /**
     * @en Asynchronously gets the URL from the UUID.
     * @param uuid The UUID.
     * @returns A promise.
     * @zh 异步根据 uuid 获取 URL。
     * @param uuid UUID
     * @returns 一个promise。
     */
    UUID_to_URL_async(uuid: string): Promise<string> {
        return Promise.resolve(null);
    }

    /**
     * @en Asynchronously gets the UUID from the URL.
     * @param url The URL.
     * @returns A promise.
     * @zh 异步根据 URL 获取 UUID。
     * @param url URL
     * @returns 一个 promise。
     */
    URL_to_UUID_async(url: string): Promise<string> {
        return Promise.resolve(null);
    }

    /**
     * @en Resolves the real URL from a given URL.
     * @param url The original URL.
     * @param onResolve Optional callback when the URL is resolved.
     * @returns A promise that resolves to the real URL.
     * @zh 根据给定的 URL 解析真实的 URL。
     * @param url 原始 URL。
     * @param onResolve 可选的回调函数，当 URL 被解析时调用。
     * @returns 一个promise，解析为真实的 URL。
     */
    resolveURL(url: string, onResolve?: (url: string) => void): Promise<string> {
        if (url.startsWith("res://")) {
            let uuid = url.substring(6);
            return AssetDb.inst.UUID_to_URL_async(uuid).then(url => {
                if (onResolve)
                    onResolve(url);
                return url;
            });
        }
        else {
            if (onResolve)
                onResolve(url);
            return Promise.resolve(url);
        }
    }

    /** 
     * UUID -> URL 如果传入的就是URL则直接返回 (caochangli)
     * @param uuid 
     * @param onCallBack
     */
    uuidToUrl(uuid: string, onCallBack: (uuid: string,url: string) => void) {
        if (!uuid || !onCallBack) return;
        if (uuid.startsWith("res://")) {
            AssetDb.inst.UUID_to_URL_async(uuid.substring(6)).then(url => {
                onCallBack(uuid,url);
            });
        }
        else {
            onCallBack(uuid,uuid);
        }
    }

    /**
     * @en Finds the URL for a shader name.
     * @param shaderName The shader name.
     * @returns The URL corresponding to the shader name.
     * @zh 根据着色器名称查找 URL。
     * @param shaderName 着色器名称。
     * @returns 着色器名称对应的 URL。
     */
    shaderName_to_URL(shaderName: string): string {
        return this.shaderNameMap[shaderName];
    }

    /**
     * @en Asynchronously finds the URL for a shader name.
     * @param shaderName The shader name.
     * @returns A promise.
     * @zh 异步根据着色器名称查找 URL。
     * @param shaderName 着色器名称。
     * @returns 一个 promise。
     */
    shaderName_to_URL_async(shaderName: string): Promise<string> {
        return Promise.resolve(null);
    }

    /**
     * @en Gets the metadata for a resource.
     * @param url The resource URL.
     * @param uuid The resource UUID.
     * @returns A promise.
     * @zh 获取资源的元数据。
     * @param url 资源的 URL。
     * @param uuid 资源的 UUID。
     * @returns 一个 promise。
     */
    getMeta(url: string, uuid: string): Promise<any> {
        return Promise.resolve(null);
    }

    /**
     * @en Gets the URL for a sub-asset.
     * @param url The base resource URL.
     * @param uuid The UUID of the base resource.
     * @param subAssetName The name of the sub-asset.
     * @param subAssetExt The file extension of the sub-asset.
     * @returns The URL for the sub-asset.
     * @zh 获取子资源的 URL。
     * @param url 基础资源的 URL。
     * @param uuid 基础资源的 UUID。
     * @param subAssetName 子资源的名称。
     * @param subAssetExt 子资源的文件扩展名。
     * @returns 子资源的 URL。
     */
    getSubAssetURL(url: string, uuid: string, subAssetName: string, subAssetExt: string): string {
        if (subAssetName)
            return `${Utils.replaceFileExtension(url, "")}@${subAssetName}.${subAssetExt}`;
        else
            return url;
    }

    /**
     * @en Gets the URL for the I18n settings.
     * @param id The I18n settings ID.
     * @returns The URL for the I18n settings.
     * @zh 获取 I18n 设置的 URL。
     * @param id I18n 设置的 ID。
     * @returns I18n 设置的 URL。 
     */
    getI18nSettingsURL(id: string): string {
        return this.i18nUrlMap[id];
    }

    /**
     * caochangli - 预览模式下获取图集中小图转换
     * @param url 
     */
    previewAtlasTexture(url:string):Texture
    {
        if (!LayaEnv.isPreview || !url)
            return null;
        
        // 预览模式坑爹点，发布后没有uuid，全部用路径不存在此坑
        // 即便图集已加载，首次getRes("res://***@***")还是获取不到资源，因为uuid和路径映射关系还没有，必须走一遍异步load加载才会建立映射关系
        // 这就意味着即便预加载了图集，使用图集散图还是无法直接同步获取，只能走异步加载

        let tex:Texture;
        let index = url.indexOf("@");
        if (index >= 0 && url.startsWith("res://"))
        {
            let atlasUUID = url.substring(0,index);
            let atlas = ILaya.Loader.getAtlas(atlasUUID);
            if (atlas)
            {
                let imgName = url.substring(index + 1);
                let imgUrl = `${atlas.dir}${imgName}.png`;
                tex = ILaya.Loader.getRes(imgUrl);
                if (!tex)
                {
                    imgUrl = `${atlas.dir}${imgName}.jpg`;
                    tex = ILaya.Loader.getRes(imgUrl);
                }
                if (tex)
                {
                    let texUUID = `${atlasUUID.substring(6)}@${imgName}`;
                    tex.uuid = texUUID;
                    this.uuidMap[texUUID] = tex.url;
                    this.uuidMap[tex.url] = texUUID;
                }
            }
        }

        return tex;
    }
}