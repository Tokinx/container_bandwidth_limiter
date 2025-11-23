import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { containerApi, Container } from '@/lib/api';
import { formatBytes, formatDate, getStatusColor, getStatusText } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Play, Square, RefreshCw, Share2, Trash2, Settings } from 'lucide-react';

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [selectedContainer, setSelectedContainer] = useState<Container | null>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [shareDialog, setShareDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [shareUrl, setShareUrl] = useState('');

  // 配置表单状态
  const [editForm, setEditForm] = useState({
    bandwidth_limit: '',
    bandwidth_extra: '',
    reset_day: '',
    expire_at: '',
  });

  const { data: containers, isLoading } = useQuery({
    queryKey: ['containers'],
    queryFn: async () => {
      const response = await containerApi.getAll();
      return response.data;
    },
    refetchInterval: 5000,
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => containerApi.start(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['containers'] }),
  });

  const stopMutation = useMutation({
    mutationFn: (id: string) => containerApi.stop(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['containers'] }),
  });

  const resetMutation = useMutation({
    mutationFn: (id: string) => containerApi.reset(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['containers'] }),
  });

  const refreshMutation = useMutation({
    mutationFn: () => containerApi.refresh(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['containers'] }),
    onError: () => alert('刷新失败，请稍后重试'),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      containerApi.delete(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containers'] });
      setDeleteDialog(false);
      setConfirmName('');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      containerApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containers'] });
      setEditDialog(false);
    },
  });

  const handleEdit = (container: Container) => {
    setSelectedContainer(container);
    // 将字节转换为 GB 显示
    const limitGB = container.bandwidth_limit ? (container.bandwidth_limit / (1024 ** 3)).toFixed(2) : '';
    const extraGB = container.bandwidth_extra ? (container.bandwidth_extra / (1024 ** 3)).toFixed(2) : '0';

    setEditForm({
      bandwidth_limit: limitGB,
      bandwidth_extra: extraGB,
      reset_day: container.reset_day?.toString() || '',
      expire_at: container.expire_at ? new Date(container.expire_at).toISOString().slice(0, 16) : '',
    });
    setEditDialog(true);
  };

  const handleUpdate = () => {
    if (!selectedContainer) return;

    const data: any = {};

    // 将 GB 转换为字节
    if (editForm.bandwidth_limit) {
      data.bandwidth_limit = Math.floor(parseFloat(editForm.bandwidth_limit) * (1024 ** 3));
    }
    if (editForm.bandwidth_extra) {
      data.bandwidth_extra = Math.floor(parseFloat(editForm.bandwidth_extra) * (1024 ** 3));
    }
    if (editForm.reset_day) {
      data.reset_day = parseInt(editForm.reset_day);
    }
    if (editForm.expire_at) {
      data.expire_at = new Date(editForm.expire_at).getTime();
    }

    updateMutation.mutate({ id: selectedContainer.id, data });
  };

  const handleShare = async (container: Container) => {
    const response = await containerApi.getShareToken(container.id);
    const fullUrl = `${window.location.origin}/share/${response.data.token}`;
    setShareUrl(fullUrl);
    setShareDialog(true);
  };

  const handleDelete = () => {
    if (selectedContainer) {
      deleteMutation.mutate({ id: selectedContainer.id, name: confirmName });
    }
  };

  if (isLoading) {
    return <div className="p-8">加载中...</div>;
  }

  return (
    <div className="p-8">
      <div className="flex flex-col gap-4 mb-8 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">容器管理</h1>
          <p className="text-muted-foreground mt-2">监控和管理Docker容器流量</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
        >
          <RefreshCw
            className={`w-4 h-4 mr-1 ${refreshMutation.isPending ? 'animate-spin' : ''}`}
          />
          {refreshMutation.isPending ? '刷新中...' : '手动刷新'}
        </Button>
      </div>

      <div className="grid gap-4">
        {containers?.map((container) => {
          const totalLimit = (container.bandwidth_limit || 0) + container.bandwidth_extra;
          const remaining = Math.max(0, totalLimit - container.bandwidth_used);
          const usagePercent = totalLimit > 0 ? (container.bandwidth_used / totalLimit) * 100 : 0;

          return (
            <Card key={container.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{container.name}</CardTitle>
                    <p className={`text-sm mt-1 ${getStatusColor(container.status)}`}>
                      {getStatusText(container.status)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(container)}
                    >
                      <Settings className="w-4 h-4 mr-1" />
                      配置
                    </Button>
                    {container.status === 'stopped' || container.status === 'expired' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startMutation.mutate(container.id)}
                      >
                        <Play className="w-4 h-4 mr-1" />
                        启动
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => stopMutation.mutate(container.id)}
                      >
                        <Square className="w-4 h-4 mr-1" />
                        停止
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resetMutation.mutate(container.id)}
                    >
                      <RefreshCw className="w-4 h-4 mr-1" />
                      重置
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleShare(container)}
                    >
                      <Share2 className="w-4 h-4 mr-1" />
                      分享
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setSelectedContainer(container);
                        setDeleteDialog(true);
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      删除
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">已用流量</p>
                    <p className="text-lg font-semibold">{formatBytes(container.bandwidth_used)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">流量限制</p>
                    <p className="text-lg font-semibold">
                      {container.bandwidth_limit ? formatBytes(totalLimit) : '无限制'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">剩余流量</p>
                    <p className="text-lg font-semibold">
                      {container.bandwidth_limit ? formatBytes(remaining) : '无限制'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">到期时间</p>
                    <p className="text-lg font-semibold">{formatDate(container.expire_at)}</p>
                  </div>
                </div>
                {container.bandwidth_limit && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span>使用率</span>
                      <span>{usagePercent.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          usagePercent > 90 ? 'bg-red-500' : usagePercent > 70 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(usagePercent, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>配置容器 - {selectedContainer?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">流量限制 (GB)</label>
              <Input
                type="number"
                step="0.01"
                value={editForm.bandwidth_limit}
                onChange={(e) => setEditForm({ ...editForm, bandwidth_limit: e.target.value })}
                placeholder="留空表示无限制"
              />
              <p className="text-xs text-muted-foreground mt-1">
                每月基础流量配额
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">临时额外流量 (GB)</label>
              <Input
                type="number"
                step="0.01"
                value={editForm.bandwidth_extra}
                onChange={(e) => setEditForm({ ...editForm, bandwidth_extra: e.target.value })}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground mt-1">
                临时增加的流量配额，重置时会清零
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">每月重置日期 (1-31)</label>
              <Input
                type="number"
                min="1"
                max="31"
                value={editForm.reset_day}
                onChange={(e) => setEditForm({ ...editForm, reset_day: e.target.value })}
                placeholder="1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                每月的哪一天重置流量（例如：1 表示每月1号）
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">到期时间</label>
              <Input
                type="datetime-local"
                value={editForm.expire_at}
                onChange={(e) => setEditForm({ ...editForm, expire_at: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                容器到期后将自动停止
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>
              取消
            </Button>
            <Button onClick={handleUpdate}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={shareDialog} onOpenChange={setShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>分享链接</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input value={shareUrl} readOnly />
            <Button
              onClick={() => {
                navigator.clipboard.writeText(shareUrl);
                alert('已复制到剪贴板');
              }}
              className="w-full"
            >
              复制链接
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除容器</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              请输入容器名称 <strong>{selectedContainer?.name}</strong> 以确认删除
            </p>
            <Input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder="输入容器名称"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={confirmName !== selectedContainer?.name}
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
