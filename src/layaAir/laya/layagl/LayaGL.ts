import { I2DRenderPassFactory } from "../RenderDriver/DriverDesign/2DRenderPass/I2DRenderPassFactory";
import { IRenderDeviceFactory } from "../RenderDriver/DriverDesign/RenderDevice/IRenderDeviceFactory";
import { IRenderEngine } from "../RenderDriver/DriverDesign/RenderDevice/IRenderEngine";
import { ITextureContext } from "../RenderDriver/DriverDesign/RenderDevice/ITextureContext";
import { IUnitRenderModuleDataFactory } from "../RenderDriver/RenderModuleData/Design/IUnitRenderModuleDataFactory";
import { DefaultStaticsContext, IStaticsContext } from "./StatisticsContext";

/**
 * @en Package GL commands
 * @zh 封装GL命令
 */
export class LayaGL {
    static textureContext: ITextureContext;
    static renderEngine: IRenderEngine;
    static render2DRenderPassFactory: I2DRenderPassFactory;
    static renderDeviceFactory: IRenderDeviceFactory;
    static unitRenderModuleDataFactory: IUnitRenderModuleDataFactory;
    static statAgent: IStaticsContext = new DefaultStaticsContext();

//#region caochangli - 新增renderFlag字段使用开关

    /**启用图片&文字元素renderFlag字段 - 对设置了renderFlag标记的图文元素，在即便不能合批的情况下，通过调整渲染顺序达到不打断后续元素合批 */
    static enableGraphicsRenderFlag:boolean = true;

    /**启用spine元素renderFlag字段 - 对设置了renderFlag标记的spine元素，在即便不能合批的情况下，通过调整渲染顺序达到不打断后续元素合批 */
    static enableSpineRenderFlag:boolean = true;
    
//#endregion 新增renderFlag字段使用开关

}