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
  const [editDialog, setEditDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [shareDialog, setShareDialog] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [shareUrl, setShareUrl] = useState('');

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

  const deleteMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      containerApi.delete(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containers'] });
      setDeleteDialog(false);
      setConfirmName('');
    },
  });

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
      <div className="mb-8">
        <h1 className="text-3xl font-bold">容器管理</h1>
        <p className="text-muted-foreground mt-2">监控和管理Docker容器流量</p>
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
                      variant="outline"
                      onClick={() => {
                        setSelectedContainer(container);
                        setEditDialog(true);
                      }}
                    >
                      <Settings className="w-4 h-4 mr-1" />
                      配置
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
