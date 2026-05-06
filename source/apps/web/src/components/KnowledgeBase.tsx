import { useState } from 'react';
import { trpc } from '../utils/trpc';
import { Book, Search, ChevronRight, Eye, Clock, User, Plus, X, Globe, Lock, Edit2, Trash2, Settings } from 'lucide-react';

export function KnowledgeBase({ onBack }: { onBack?: () => void }) {
    const [search, setSearch] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(undefined);
    const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingArticle, setEditingArticle] = useState<any>(null);
    const [viewHistoryArticle, setViewHistoryArticle] = useState<any>(null);

    const { data: me } = (trpc as any).auth.me.useQuery();
    const isAdmin = me?.role === 'ADMIN';

    const { data: categories = [] } = (trpc as any).knowledge.listCategories.useQuery();
    const { data: articles = [], isLoading } = (trpc as any).knowledge.listArticles.useQuery({
        categoryId: selectedCategoryId,
        search: search || undefined
    });

    const { data: activeArticle } = (trpc as any).knowledge.getArticle.useQuery(
        { id: selectedArticleId! },
        { enabled: !!selectedArticleId }
    );

    const utils = (trpc as any).useContext();
    const deleteMutation = (trpc as any).knowledge.deleteArticle.useMutation({
        onSuccess: () => {
            utils.knowledge.listArticles.invalidate();
            setSelectedArticleId(null);
        }
    });

    const handleDelete = (id: string) => {
        if (confirm('Tem certeza que deseja excluir este artigo?')) {
            deleteMutation.mutate({ id });
        }
    };

    const handleEdit = (article: any) => {
        setEditingArticle(article);
        setShowModal(true);
    };

    return (
        <div className="space-y-6">
            {/* Header / Search */}
            <div className="bg-card border border-border p-8 rounded-[2.5rem] shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => onBack ? onBack() : window.history.back()}
                            className="p-3 bg-card hover:bg-page border border-border rounded-2xl text-main/60 hover:text-main transition-all shadow-sm active:scale-90 flex items-center gap-2 group"
                            title="Voltar ao Início"
                        >
                            <ChevronRight className="w-5 h-5 rotate-180 group-hover:-translate-x-1 transition-transform" />
                            <span className="text-[10px] font-black uppercase tracking-widest hidden md:block">Voltar</span>
                        </button>
                        <div>
                            <h2 className="text-2xl font-black text-main italic flex items-center gap-3">
                                <Book className="w-6 h-6 text-main" /> Base de Conhecimento
                            </h2>
                            <p className="text-sm text-main/50 font-medium ml-0 mt-1">
                                {categories.reduce((acc: number, cat: any) => acc + (cat._count?.articles || 0), 0)} soluções catalogadas no repositório técnico
                            </p>
                        </div>
                    </div>

                <div className="flex items-center gap-4">
                    {isAdmin && (
                        <button
                            onClick={() => { setEditingArticle(null); setShowModal(true); }}
                            className="bg-accent hover:bg-accent text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-accent/20 active:scale-95 flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> Novo Artigo
                        </button>
                    )}
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-main/40" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Pesquisar soluções..."
                            className="bg-card/50 border border-border rounded-2xl py-3 pl-12 pr-6 text-sm text-main focus:border-primary/50 outline-none w-full md:w-80 transition-all placeholder:text-main/30"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Categories Sidebar */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-card border border-border p-6 rounded-[2rem] shadow-xl space-y-6">
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black text-main/40 uppercase tracking-[0.2em] ml-2">Navegação</h3>
                            <button
                                onClick={() => onBack?.()}
                                className="w-full text-left px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center gap-3 border border-red-500/20 shadow-lg shadow-red-500/5 group"
                            >
                                <ChevronRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" /> Sair do Módulo
                            </button>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black text-main/40 uppercase tracking-[0.2em] ml-2">Categorias</h3>
                            <div className="space-y-1">
                            <button
                                onClick={() => setSelectedCategoryId(undefined)}
                                className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${!selectedCategoryId ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-main/50 hover:bg-card hover:text-main'}`}
                            >
                                Todas as Soluções
                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${!selectedCategoryId ? 'bg-white/20' : 'bg-card text-main/40'}`}>
                                    {categories.reduce((acc: number, cat: any) => acc + (cat._count?.articles || 0), 0)}
                                </span>
                            </button>
                            {categories.map((cat: any) => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategoryId(cat.id)}
                                    className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${selectedCategoryId === cat.id ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-main/50 hover:bg-card hover:text-main'}`}
                                >
                                    {cat.name}
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${selectedCategoryId === cat.id ? 'bg-white/20' : 'bg-card text-main/40'}`}>
                                        {cat._count.articles}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                </div>

                {/* Main Content */}
                <div className="lg:col-span-3">
                    {activeArticle ? (
                        <div className="bg-card border border-border rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="p-8 border-b border-border bg-card/50 flex justify-between items-start">
                                <div className="flex-1">
                                    <button
                                        onClick={() => setSelectedArticleId(null)}
                                        className="text-[10px] font-black text-main uppercase tracking-widest hover:text-main/80 flex items-center gap-1 mb-2"
                                    >
                                        ← Voltar para a lista
                                    </button>
                                    <div className="flex items-center gap-3 mb-2">
                                        <h2 className="text-3xl font-black text-main italic tracking-tight">{activeArticle.title}</h2>
                                        {activeArticle.serviceType && (
                                            <span className="text-[10px] font-black bg-primary/10 text-main border border-primary/20 px-3 py-1 rounded-lg uppercase tracking-widest">
                                                {activeArticle.serviceType.name}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4 mt-4 text-[10px] font-bold text-main/40 uppercase tracking-wider">
                                        <div className="flex items-center gap-1.5 bg-card px-3 py-1.5 rounded-lg border border-border">
                                            <User className="w-3 h-3" /> {activeArticle.author.name}
                                        </div>
                                        <div className="flex items-center gap-1.5 bg-card px-3 py-1.5 rounded-lg border border-border">
                                            <Clock className="w-3 h-3" /> {new Date(activeArticle.createdAt).toLocaleDateString()}
                                        </div>
                                        <button
                                            onClick={() => isAdmin && setViewHistoryArticle(activeArticle)}
                                            className={`flex items-center gap-1.5 bg-card px-3 py-1.5 rounded-lg border border-border transition-all ${isAdmin ? 'hover:bg-card/80 hover:text-main cursor-pointer' : 'cursor-default'}`}
                                            title={isAdmin ? "Ver histórico de visualizações" : ""}
                                        >
                                            <Eye className="w-3 h-3" /> {activeArticle.views} visualizações
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {isAdmin && (
                                        <>
                                            <button
                                                onClick={() => handleEdit(activeArticle)}
                                                className="p-3 bg-card hover:bg-card/80 text-main rounded-xl transition-all shadow-lg active:scale-95 border border-border"
                                                title="Editar Artigo"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(activeArticle.id)}
                                                className="p-3 bg-card hover:bg-red-500/10 text-red-500 rounded-xl transition-all shadow-lg active:scale-95 border border-red-500/10"
                                                title="Excluir Artigo"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                    <div className="p-3 bg-card rounded-xl text-main/40 border border-border">
                                        {activeArticle.isPublic ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                                    </div>
                                </div>
                            </div>
                            <div className="p-10 prose prose-invert prose-blue max-w-none">
                                <div dangerouslySetInnerHTML={{ __html: activeArticle.content.replace(/\n/g, '<br/>') }} className="text-main/80 leading-relaxed text-sm" />

                                {(activeArticle.tags.length > 0 || activeArticle.serviceType) && (
                                    <div className="mt-12 pt-8 border-t border-border flex flex-wrap gap-3">
                                        {activeArticle.serviceType && (
                                            <div className="flex items-center gap-2 bg-primary/5 border border-primary/10 px-4 py-2 rounded-xl">
                                                <Settings className="w-3.5 h-3.5 text-main" />
                                                <span className="text-[10px] font-black text-main uppercase tracking-widest">
                                                    Vínculo: {activeArticle.serviceType.name}
                                                </span>
                                            </div>
                                        )}
                                        {activeArticle.tags.map((tag: string) => (
                                            <span key={tag} className="bg-card border border-border text-main/40 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:text-main hover:border-primary/30 transition-all cursor-default">
                                                #{tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {isLoading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] h-48 animate-pulse" />
                                ))
                            ) : articles.length === 0 ? (
                                <div className="col-span-2 bg-slate-900/50 border border-dashed border-slate-800 p-12 rounded-[2.5rem] text-center">
                                    <Book className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                                    <p className="text-secondary font-bold italic tracking-tight">Nenhum artigo encontrado nesta categoria.</p>
                                </div>
                            ) : articles.map((article: any) => (
                                <article
                                    key={article.id}
                                    onClick={() => setSelectedArticleId(article.id)}
                                    className="bg-card border border-border p-8 rounded-[2rem] hover:border-primary/50 transition-all cursor-pointer group hover:shadow-2xl hover:shadow-primary/5 relative overflow-hidden"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex gap-2">
                                            <span className="text-[10px] font-black text-main uppercase tracking-[0.2em] italic bg-primary/5 px-3 py-1 rounded-lg">
                                                {article.category?.name || 'Geral'}
                                            </span>
                                            {article.serviceType && (
                                                <span className="text-[10px] font-black text-accent uppercase tracking-[0.2em] italic bg-accent/5 px-3 py-1 rounded-lg border border-accent/10">
                                                    Solução Técnica
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-main/20 group-hover:text-main transition-colors">
                                            <ChevronRight className="w-5 h-5" />
                                        </span>
                                    </div>
                                    <h3 className="text-xl font-black text-main italic mb-4 leading-tight group-hover:text-main/80 transition-colors line-clamp-2">
                                        {article.title}
                                    </h3>
                                    <div className="flex items-center gap-4 text-[10px] font-bold text-main/40 uppercase tracking-widest">
                                        <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {article.author.name}</span>
                                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {new Date(article.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    {article.serviceType && (
                                        <div className="mt-4 pt-4 border-t border-border/50 text-[9px] font-black text-main/30 uppercase tracking-widest flex items-center gap-2">
                                            <Settings className="w-3 h-3" /> Vinculado a: {article.serviceType.name}
                                        </div>
                                    )}
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {showModal && (
                <ArticleModal
                    categories={categories}
                    article={editingArticle}
                    onClose={() => { setShowModal(false); setEditingArticle(null); }}
                />
            )}

            {viewHistoryArticle && (
                <ViewHistoryModal
                    article={viewHistoryArticle}
                    onClose={() => setViewHistoryArticle(null)}
                />
            )}
        </div>
    );
}

function ViewHistoryModal({ article, onClose }: { article: any; onClose: () => void }) {
    const { data: views = [], isLoading } = (trpc as any).knowledge.listArticleViews.useQuery({ id: article.id });

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-6">
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                    <div>
                        <h3 className="text-[10px] font-black text-accent uppercase tracking-widest italic mb-1">Audit Trail</h3>
                        <h2 className="text-xl font-black text-white italic tracking-tight">Histórico de Visualizações</h2>
                        <p className="text-[10px] text-secondary font-bold uppercase tracking-wider mt-1">{article.title}</p>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-slate-800 rounded-2xl transition-all">
                        <X className="w-5 h-5 text-secondary" />
                    </button>
                </div>

                <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {isLoading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-16 bg-slate-800 animate-pulse rounded-2xl" />
                            ))}
                        </div>
                    ) : views.length === 0 ? (
                        <div className="text-center py-8">
                            <Eye className="w-8 h-8 text-slate-800 mx-auto mb-2" />
                            <p className="text-secondary font-bold italic text-sm">Nenhuma visualização detalhada registrada.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {views.map((view: any) => (
                                <div key={view.id} className="bg-slate-800/50 border border-slate-800 p-4 rounded-2xl flex items-center justify-between group hover:border-accent/30 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-accent/10 rounded-xl flex items-center justify-center border border-accent/20">
                                            <User className="w-4 h-4 text-accent" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-black text-white italic">@{view.user.name}</div>
                                            <div className="text-[9px] text-secondary font-bold uppercase tracking-tight">{view.user.email}</div>
                                        </div>
                                    </div>
                                    <div className="text-[9px] font-black text-secondary/70 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 group-hover:text-accent transition-colors">
                                        {new Date(view.viewedAt).toLocaleString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-8 border-t border-slate-800 bg-slate-900/50 text-center">
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest italic leading-tight">
                        * O registro de visualizações detalhadas começou em {new Date().toLocaleDateString()}
                    </p>
                </div>
            </div>
        </div>
    );
}

function ArticleModal({ categories, article, onClose }: any) {
    const isEditing = !!article;
    const [title, setTitle] = useState(article?.title || '');
    const [categoryId, setCategoryId] = useState(article?.categoryId || '');
    const [serviceTypeId, setServiceTypeId] = useState(article?.serviceTypeId || '');
    const [content, setContent] = useState(article?.content || '');
    const [tags, setTags] = useState(article?.tags?.join(', ') || '');
    const [isPublic, setIsPublic] = useState(article?.isPublic ?? true);

    const { data: serviceGroups = [] } = (trpc as any).serviceTypes.listGroups.useQuery();

    const utils = (trpc as any).useContext();
    const mutation = (trpc as any).knowledge[isEditing ? 'updateArticle' : 'createArticle'].useMutation({
        onSuccess: () => {
            utils.knowledge.listArticles.invalidate();
            if (isEditing) utils.knowledge.getArticle.invalidate({ id: article.id });
            onClose();
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const data = {
            title,
            content,
            categoryId: categoryId || undefined,
            serviceTypeId: serviceTypeId || undefined,
            tags: tags.split(',').map((t: string) => t.trim()).filter((t: string) => !!t),
            isPublic
        };

        if (isEditing) {
            mutation.mutate({ id: article.id, ...data });
        } else {
            mutation.mutate(data);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] w-full max-w-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-8 border-b border-slate-800">
                    <div>
                        <h2 className="text-2xl font-black text-white italic tracking-tight uppercase">
                            {isEditing ? 'Editar Artigo' : 'Novo Artigo'}
                        </h2>
                        <p className="text-xs text-secondary font-bold uppercase tracking-widest mt-1">Base de Conhecimento</p>
                    </div>
                    <button onClick={onClose} className="p-3 bg-slate-800 hover:bg-slate-700 text-secondary/70 rounded-2xl transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto max-h-[75vh] custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5 md:col-span-2">
                            <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Título do Artigo</label>
                            <input
                                required
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white outline-none focus:border-accent/50 transition-all font-medium"
                                placeholder="Ex: Como resetar configurações de rede"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Categoria</label>
                            <select
                                value={categoryId}
                                onChange={e => setCategoryId(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white outline-none focus:border-accent/50 transition-all font-medium appearance-none"
                            >
                                <option value="">Geral</option>
                                {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Vincular a Serviço Técnico (Opcional)</label>
                            <select
                                value={serviceTypeId}
                                onChange={e => setServiceTypeId(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white outline-none focus:border-accent/50 transition-all font-medium appearance-none"
                            >
                                <option value="">Sem Vínculo</option>
                                {serviceGroups.map((group: any) => (
                                    <optgroup key={group.id} label={group.name}>
                                        {(group.services || []).map((type: any) => (
                                            <option key={type.id} value={type.id}>{type.name}</option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Conteúdo (Suporta Quebras de Linha)</label>
                        <textarea
                            required
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            rows={8}
                            className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white outline-none focus:border-accent/50 transition-all font-medium resize-none custom-scrollbar"
                            placeholder="Descreva a solução de forma detalhada..."
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Tags (separadas por vírgula)</label>
                            <input
                                value={tags}
                                onChange={e => setTags(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white outline-none focus:border-accent/50 transition-all font-medium"
                                placeholder="rede, reset, tutorial"
                            />
                        </div>
                        <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {isPublic ? <Globe className="w-4 h-4 text-accent" /> : <Lock className="w-4 h-4 text-secondary" />}
                                <span className="text-[10px] font-black text-white uppercase tracking-widest">Artigo Público</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsPublic(!isPublic)}
                                className={`w-12 h-6 rounded-full transition-all relative ${isPublic ? 'bg-accent' : 'bg-slate-800'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isPublic ? 'left-7' : 'left-1'}`} />
                            </button>
                        </div>
                    </div>

                    <div className="pt-4 flex items-center gap-4">
                        <button type="button" onClick={onClose} className="flex-1 px-8 py-4 text-secondary/70 hover:text-white font-bold uppercase tracking-widest text-xs transition-colors">
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={mutation.isPending}
                            className="flex-[2] bg-accent hover:bg-accent text-white px-8 py-5 rounded-2xl font-black italic transition-all disabled:opacity-50 uppercase tracking-widest text-xs shadow-lg shadow-accent/20"
                        >
                            {mutation.isPending ? 'SALVANDO...' : (isEditing ? 'SALVAR ALTERAÇÕES' : 'PUBLICAR ARTIGO')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
