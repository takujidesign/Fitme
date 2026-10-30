import { z } from './vendor/zod.js';
import { FOOD } from './foods.js';
import { EX } from './exercises.js';
const Doses = z.object({
  morning: z.number(), breakfast: z.number(), lunch: z.number(), afternoon: z.number(),
  pre: z.number(), post: z.number(), dinner: z.number(), night: z.number(),
});
const Bi = z.object({ th: z.string(), en: z.string(),zh:z.string().optional(),ja:z.string().optional(),vi:z.string().optional() });
const MealItem = z.object({name_th:z.string().min(1).max(150),name_en:z.string().min(1).max(150),kind:z.enum(['dish','ingredient','drink','packaged']),portion:z.object({amount:z.number().positive().max(10000),unit:z.enum(['plate','bowl','ladle','piece','glass','g','ml'])}),grams_est:z.number().positive().max(10000),confidence:z.number().min(0).max(1),macros_est:z.object({kcal:z.number().nonnegative().max(50000),p:z.number().nonnegative().max(10000),c:z.number().nonnegative().max(10000),f:z.number().nonnegative().max(10000)}).optional()});

const Product = z.object({
  isSupplement: z.boolean(),
  name: Bi,
  brand: z.string(),
  category: z.enum(['creatine', 'protein', 'carnitine', 'multi', 'bcomplex', 'collagen', 'antioxidant', 'other']),
  unit: Bi,
  perContainer: z.number(),
  nutrition: z.object({ k: z.number(), p: z.number(), c: z.number(), f: z.number() }),
  loadingDays: z.number(),
  note: Bi,
  rules: z.array(z.object({
    wMin: z.number().nullable(), wMax: z.number().nullable(),
    day: z.enum(['train', 'rest', 'any']), phase: z.enum(['loading', 'maint', 'any']),
    doses: Doses,
  })),
});


const Group = z.enum(['legs', 'push', 'pull', 'core', 'cardio', 'mobility']);
const Review = z.object({
  advice: z.array(Bi), swaps: z.array(z.object({ from: z.enum(Object.keys(FOOD)), to: z.enum(Object.keys(FOOD)), reason: Bi })), warnings: z.array(Bi),
});
const BodyReview = z.object({
  bodyFatRange: z.object({ min: z.number(), max: z.number() }).nullable(),
  posture: z.array(Bi), underDeveloped: z.array(Bi),
  goal: z.enum(['cut', 'recomp', 'maintain', 'bulk', 'strength']), focus: z.array(Group), warnings: z.array(Bi),
});
const item=z.discriminatedUnion('type',[
  z.object({type:z.literal('avoidEx'),value:z.array(z.enum(Object.keys(EX))).max(50)}),
  z.object({type:z.literal('swapToday'),value:z.object({from:z.enum(Object.keys(EX)),to:z.enum(Object.keys(EX))})}),
  z.object({type:z.literal('goal'),value:z.enum(['cut','bulk','recomp','maintain','strength'])}),
  z.object({type:z.literal('sessionMin'),value:z.number().int().min(15).max(120)})
]);
const Suggestions=z.object({suggestions:z.array(item).max(4)});

const Chat = z.object({text:z.string().min(1).max(16000),suggestions:Suggestions.shape.suggestions});
export {z,Doses,Bi,MealItem,Product,Review,BodyReview,Suggestions};
export const schemas={'ai/chat':Chat,'ai/plan-review':Review,'ai/body':BodyReview,'ai/meal-photo':z.object({items:z.array(MealItem).max(30)}),'label/analyze':Product};
